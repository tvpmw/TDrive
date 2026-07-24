import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { users } from "../db/schema/users.js";
import { eq, and, isNull } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../lib/bcrypt.js";
import { randomUUID } from "node:crypto";
import { downloadFile } from "../services/telegram/index.js";
import { decryptGlobal } from "../lib/crypto.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TelegramCredentials } from "../services/telegram/client.js";

export const shareRoutes = new Hono<{ Variables: Variables }>();
export const publicShareRoutes = new Hono();

function resolveLocalPath(remoteId: string): string {
  const filename = remoteId.replace("local://", "");
  const pathInCwd = join(resolve("./storage-temp"), filename);
  if (existsSync(pathInCwd)) return pathInCwd;
  const pathInApi = join(resolve("./apps/api/storage-temp"), filename);
  if (existsSync(pathInApi)) return pathInApi;
  const pathInRoot = join(resolve("../../storage-temp"), filename);
  if (existsSync(pathInRoot)) return pathInRoot;
  return pathInCwd;
}

async function getUserTelegramCreds(userId: string): Promise<TelegramCredentials | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) {
    return null;
  }
  return {
    apiId: parseInt(decryptGlobal(user.telegramApiIdEncrypted), 10),
    apiHash: decryptGlobal(user.telegramApiHashEncrypted),
    sessionString: decryptGlobal(user.telegramSessionEncrypted),
  };
}

// Authenticated: Generate/Update share link
shareRoutes.post("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = z.parse(
    z.object({
      password: z.string().optional().nullable(),
      expires_in_days: z.number().optional().nullable(),
    }),
    await c.req.json()
  );

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  const token = item.shareToken || randomUUID();
  const passwordHash = body.password ? await hashPassword(body.password) : null;
  const expiresAt = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000)
    : null;

  await db.update(driveItems).set({
    shareToken: token,
    sharePasswordHash: passwordHash,
    shareExpiresAt: expiresAt,
    updatedAt: new Date(),
  }).where(eq(driveItems.id, id));

  const [updated] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  return c.json({ data: updated });
});

// Authenticated: Revoke share link
shareRoutes.delete("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  await db.update(driveItems).set({
    shareToken: null,
    sharePasswordHash: null,
    shareExpiresAt: null,
    updatedAt: new Date(),
  }).where(and(eq(driveItems.id, id), eq(driveItems.userId, userId)));

  return c.json({ message: "Share link revoked successfully" });
});

// Public: Get share info
publicShareRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.shareToken, token), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "Share link not found or expired", statusCode: 404 }, 404);
  }

  const isExpired = item.shareExpiresAt ? new Date() > new Date(item.shareExpiresAt) : false;

  return c.json({
    data: {
      name: item.name,
      size: item.size,
      mimeType: item.mimeType,
      createdAt: item.createdAt,
      requiresPassword: !!item.sharePasswordHash,
      isExpired,
      downloadCount: item.downloadCount ?? 0,
    },
  });
});

// Public: Download shared file
publicShareRoutes.post("/:token/download", async (c) => {
  const token = c.req.param("token");
  let body: { password?: string } = {};
  try {
    body = await c.req.json();
  } catch {}

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.shareToken, token), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "Share link not found", statusCode: 404 }, 404);
  }

  if (item.shareExpiresAt && new Date() > new Date(item.shareExpiresAt)) {
    return c.json({ error: "Gone", message: "Share link has expired", statusCode: 410 }, 410);
  }

  if (item.sharePasswordHash) {
    if (!body.password) {
      return c.json({ error: "Unauthorized", message: "Password required for this share link", statusCode: 401 }, 401);
    }
    const valid = await verifyPassword(body.password, item.sharePasswordHash);
    if (!valid) {
      return c.json({ error: "Unauthorized", message: "Incorrect password", statusCode: 401 }, 401);
    }
  }

  // Increment download count
  await db.update(driveItems).set({
    downloadCount: (item.downloadCount ?? 0) + 1,
  }).where(eq(driveItems.id, item.id));

  // Stream/Deliver File
  if (item.storageRemoteId?.startsWith("local://")) {
    const localPath = resolveLocalPath(item.storageRemoteId);
    try {
      const content = await readFile(localPath);
      return new Response(new Uint8Array(content), {
        headers: {
          "Content-Type": item.mimeType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(item.name)}"`,
          "Content-Length": String(content.length),
        },
      });
    } catch {
      return c.json({ error: "Not Found", message: "Local file unavailable", statusCode: 404 }, 404);
    }
  }

  if (item.storageRemoteId?.startsWith("telegram://")) {
    const creds = await getUserTelegramCreds(item.userId);
    if (!creds) {
      return c.json({ error: "Precondition Failed", message: "Storage owner credentials unavailable", statusCode: 412 }, 412);
    }
    try {
      const clean = item.storageRemoteId.replace(/^telegram:\/\//, "");
      const [channelIdStr, messageIdStr] = clean.split("/");
      const channelId = parseInt(channelIdStr, 10);
      const messageId = parseInt(messageIdStr, 10);
      if (isNaN(channelId) || isNaN(messageId)) {
        return c.json({ error: "Internal Server Error", message: "Invalid Telegram storage ID format", statusCode: 500 }, 500);
      }
      const downloaded = await downloadFile(item.userId, creds, channelId, messageId);
      return new Response(new Uint8Array(downloaded.buffer), {
        headers: {
          "Content-Type": item.mimeType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(item.name)}"`,
          "Content-Length": String(downloaded.buffer.length),
        },
      });
    } catch (err: any) {
      return c.json({ error: "Internal Server Error", message: err.message ?? "Telegram download failed", statusCode: 500 }, 500);
    }
  }

  return c.json({ error: "Not Found", message: "File storage ID invalid", statusCode: 404 }, 404);
});
