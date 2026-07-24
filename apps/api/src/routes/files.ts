import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { users } from "../db/schema/users.js";
import { eq, and, isNull, desc, ilike } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { newId } from "../lib/utils.js";
import { getEnv } from "../env.js";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile, unlink, stat, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { decryptGlobal } from "../lib/crypto.js";
import { uploadFile, downloadFile } from "../services/telegram/index.js";
import { enqueueSync } from "../queue/index.js";
import type { TelegramCredentials } from "../services/telegram/client.js";
import { EDITABLE_EXTENSIONS } from "@tdrive/shared";

const files = new Hono<{ Variables: Variables }>();

// Storage temp directory for staging uploads
const TEMP_DIR = resolve("./storage-temp");

async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
}

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

function parseTelegramRemoteId(remoteId: string): { channelId: number; messageId: number } | null {
  const clean = remoteId.replace(/^telegram:\/\//, "");
  const parts = clean.split("/");
  if (parts.length < 2) return null;
  const channelId = parseInt(parts[0], 10);
  const messageId = parseInt(parts[1], 10);
  if (isNaN(channelId) || isNaN(messageId)) return null;
  return { channelId, messageId };
}

// List files (supports search and recursive global queries across subfolders)
files.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const parentId = c.req.query("parent_id");
  const searchParam = c.req.query("search");
  const recursive = c.req.query("recursive") === "true";

  // Auto-seed Inbox folder
  const [user] = await db.select().from(driveItems).where(
    and(eq(driveItems.userId, userId), isNull(driveItems.parentId), eq(driveItems.name, "Inbox"), isNull(driveItems.deletedAt))
  ).limit(1);

  if (!user) {
    const inboxId = newId();
    await db.insert(driveItems).values({
      id: inboxId,
      userId,
      kind: "folder",
      name: "Inbox",
      size: 0,
    });
  }

  const conditions = [
    eq(driveItems.userId, userId),
    isNull(driveItems.deletedAt),
  ];

  if (searchParam) {
    conditions.push(ilike(driveItems.name, `%${searchParam}%`));
  } else if (!recursive) {
    if (parentId) {
      conditions.push(eq(driveItems.parentId, parentId));
    } else {
      conditions.push(isNull(driveItems.parentId));
    }
  }

  const items = await db.select().from(driveItems)
    .where(and(...conditions))
    .orderBy(driveItems.kind, driveItems.name);

  return c.json({ data: items });
});

// Get single item
files.get("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  return c.json({ data: item });
});

// Create file metadata
files.post("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({
      name: z.string().min(1),
      parent_id: z.string().nullable().optional(),
      size: z.number().default(0),
      mime_type: z.string().nullable().optional(),
    }),
    await c.req.json()
  );

  const id = newId();
  await db.insert(driveItems).values({
    id,
    userId,
    kind: "file",
    name: body.name,
    parentId: body.parent_id ?? null,
    size: body.size,
    mimeType: body.mime_type ?? null,
  });

  const [item] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  return c.json({ data: item }, 201);
});

// Upload file (multipart)
files.post("/upload", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const env = getEnv();
  await ensureTempDir();

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const parentId = formData.get("parent_id") as string | null;

  if (!file) {
    return c.json({ error: "Bad Request", message: "No file provided", statusCode: 400 }, 400);
  }

  if (file.size > env.TDRIVE_MAX_UPLOAD_BYTES) {
    return c.json({ error: "Payload Too Large", message: `File exceeds ${env.TDRIVE_MAX_UPLOAD_BYTES} bytes`, statusCode: 413 }, 413);
  }

  // Stage file locally
  const fileUuid = randomUUID();
  const remoteId = `local://${fileUuid}`;
  const stagedPath = join(TEMP_DIR, fileUuid);
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Calculate SHA256 Hash for instant upload deduplication
  const cryptoModule = await import("node:crypto");
  const fileHash = cryptoModule.createHash("sha256").update(buffer).digest("hex");

  // Check if hash already exists in database (Deduplication / Instant 0-sec Upload)
  const [existingFile] = await db.select().from(driveItems)
    .where(and(eq(driveItems.fileHash, fileHash), isNull(driveItems.deletedAt)))
    .limit(1);

  if (existingFile) {
    // 0-sec instant upload (Reuse Telegram File ID & Remote Storage ID)
    const id = newId();
    await db.insert(driveItems).values({
      id,
      userId,
      kind: "file",
      name: file.name,
      parentId: parentId || null,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      storageProvider: existingFile.storageProvider,
      storageRemoteId: existingFile.storageRemoteId,
      storageChannelName: existingFile.storageChannelName,
      telegramTopicId: existingFile.telegramTopicId,
      syncStatus: existingFile.syncStatus,
      fileHash: fileHash,
    });

    const [item] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
    return c.json({ data: item, instantUpload: true }, 201);
  }

  await writeFile(stagedPath, buffer);

  let finalSyncStatus = "local";
  let finalRemoteId = remoteId;

  // Auto-sync attempt
  const userCreds = await getUserTelegramCreds(userId);
  if (userCreds) {
    try {
      // Find parent folder topic ID if uploading inside a folder
      let topicId: string | number | undefined = undefined;
      if (parentId) {
        const [parentFolder] = await db.select().from(driveItems).where(eq(driveItems.id, parentId)).limit(1);
        if (parentFolder?.telegramTopicId) {
          topicId = parentFolder.telegramTopicId;
        }
      }

      const result = await uploadFile(
        userId,
        userCreds.creds,
        stagedPath,
        file.name,
        file.type || undefined,
        topicId,
        userCreds.channelName,
        userCreds.isSupergroup
      );
      finalRemoteId = `telegram://${result.channelId}/${result.messageId}`;
      finalSyncStatus = "synced";
      await unlink(stagedPath).catch(() => {});
    } catch {
      // Fallback to local if Telegram auto-sync encounters transient error
    }
  }

  const id = newId();
  await db.insert(driveItems).values({
    id,
    userId,
    kind: "file",
    name: file.name,
    parentId: parentId || null,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    storageProvider: finalSyncStatus === "synced" ? (userCreds?.isSupergroup ? "telegram-supergroup-topic" : "telegram-private-channel") : "local",
    storageRemoteId: finalRemoteId,
    storageChannelName: userCreds?.channelName || "TeleDrive Storage",
    syncStatus: finalSyncStatus,
    fileHash: fileHash,
  });

  const [item] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  return c.json({ data: item }, 201);
});

// Toggle Starred (Favorites)
files.post("/:id/star", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [item] = await db.select().from(driveItems).where(and(eq(driveItems.id, id), eq(driveItems.userId, userId))).limit(1);
  if (!item) return c.json({ error: "Not Found" }, 404);

  const newStarred = item.isStarred === 1 ? 0 : 1;
  await db.update(driveItems).set({ isStarred: newStarred }).where(eq(driveItems.id, id));
  return c.json({ data: { id, isStarred: newStarred } });
});

// Duplicate file
files.post("/:id/duplicate", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [item] = await db.select().from(driveItems).where(and(eq(driveItems.id, id), eq(driveItems.userId, userId))).limit(1);
  if (!item) return c.json({ error: "Not Found" }, 404);

  const newIdVal = newId();
  await db.insert(driveItems).values({
    ...item,
    id: newIdVal,
    name: `${item.name} (Copy)`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const [newItem] = await db.select().from(driveItems).where(eq(driveItems.id, newIdVal)).limit(1);
  return c.json({ data: newItem }, 201);
});

// Helper: resolve user's Telegram credentials and storage settings
async function getUserTelegramCreds(userId: string): Promise<{ creds: TelegramCredentials; channelName?: string; isSupergroup: boolean } | null> {
  const env = getEnv();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) {
    return null;
  }
  return {
    creds: {
      apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
      apiHash: decryptGlobal(user.telegramApiHashEncrypted),
      sessionString: decryptGlobal(user.telegramSessionEncrypted),
    },
    channelName: user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL,
    isSupergroup: (user.telegramStorageMode || "supergroup") === "supergroup",
  };
}

// Download or Stream file (supports Range requests for media streaming)
files.get("/:id/download", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const inline = c.req.query("inline") === "true";

  let [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    [item] = await db.select().from(driveItems)
      .where(and(eq(driveItems.id, id), isNull(driveItems.deletedAt)))
      .limit(1);
  }

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  const dispositionType = inline ? "inline" : "attachment";
  const targetUserId = userId || item.userId;

  // 1. Check local staged file first (for instant local playback)
  const localRemotePath = item.storageRemoteId?.startsWith("local://") ? resolveLocalPath(item.storageRemoteId) : resolveLocalPath(item.id);
  if (existsSync(localRemotePath)) {
    try {
      const fileStat = await stat(localRemotePath);
      const totalSize = fileStat.size;
      const rangeHeader = c.req.header("range");

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunksize = (end - start) + 1;

        const content = await readFile(localRemotePath);
        const chunk = content.subarray(start, end + 1);

        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunksize),
            "Content-Type": item.mimeType ?? "application/octet-stream",
            "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(item.name)}"`,
          },
        });
      }

      const content = await readFile(localRemotePath);
      return new Response(new Uint8Array(content), {
        headers: {
          "Content-Type": item.mimeType ?? "application/octet-stream",
          "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(item.name)}"`,
          "Content-Length": String(totalSize),
          "Accept-Ranges": "bytes",
        },
      });
    } catch {}
  }

  // 2. Download from Telegram if not in local cache
  if (item.storageRemoteId?.startsWith("telegram://")) {
    const userCreds = await getUserTelegramCreds(targetUserId);
    if (!userCreds) {
      return c.json({ error: "Precondition Failed", message: "Telegram credentials not configured", statusCode: 412 }, 412);
    }
    try {
      const tgInfo = parseTelegramRemoteId(item.storageRemoteId);
      if (!tgInfo) {
        return c.json({ error: "Internal Server Error", message: "Invalid Telegram remote ID format", statusCode: 500 }, 500);
      }

      const rangeHeader = c.req.header("range");
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10) || 0;
        const requestedSize = parts[1] ? (parseInt(parts[1], 10) - start + 1) : (1024 * 1024);
        const chunkSize = Math.min(requestedSize, 2 * 1024 * 1024); // Cap chunk to 2MB for ultra-fast response

        const { buffer, totalSize } = await downloadFile(targetUserId, userCreds.creds, tgInfo.channelId, tgInfo.messageId, start, chunkSize);
        const end = Math.min(start + buffer.length - 1, (totalSize > 0 ? totalSize - 1 : start + buffer.length - 1));

        return new Response(new Uint8Array(buffer), {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${totalSize || (end + 1)}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(buffer.length),
            "Content-Type": item.mimeType ?? "application/octet-stream",
            "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(item.name)}"`,
          },
        });
      }

      const { buffer, totalSize } = await downloadFile(targetUserId, userCreds.creds, tgInfo.channelId, tgInfo.messageId, 0);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": item.mimeType ?? "application/octet-stream",
          "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(item.name)}"`,
          "Content-Length": String(totalSize),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (err: any) {
      return c.json({ error: "Internal Server Error", message: err.message || "Failed to download from Telegram", statusCode: 500 }, 500);
    }
  }

  return c.json({ error: "Not Found", message: "File not available", statusCode: 404 }, 404);
});

// Update file (rename/move)
files.patch("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = z.parse(
    z.object({
      name: z.string().min(1).optional(),
      parent_id: z.string().nullable().optional(),
    }),
    await c.req.json()
  );

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.parent_id !== undefined) updates.parentId = body.parent_id;

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  await db.update(driveItems).set(updates).where(eq(driveItems.id, id));
  const [updated] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);

  return c.json({ data: updated });
});

// Delete file (soft delete → trash)
files.delete("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  await db.update(driveItems).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(driveItems.id, id));
  return c.body(null, 204);
});

// Sync file to Telegram
files.post("/:id/sync", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  if (!item.storageRemoteId?.startsWith("local://")) {
    return c.json({ error: "Bad Request", message: "File is not a local file", statusCode: 400 }, 400);
  }

  const userCreds = await getUserTelegramCreds(userId);
  if (!userCreds) {
    return c.json({ error: "Precondition Failed", message: "Telegram credentials not configured", statusCode: 412 }, 412);
  }

  // Update sync status
  await db.update(driveItems).set({ syncStatus: "syncing", updatedAt: new Date() }).where(eq(driveItems.id, id));

  try {
    const localPath = resolveLocalPath(item.storageRemoteId);
    const result = await uploadFile(userId, userCreds.creds, localPath, item.name, item.mimeType ?? undefined, undefined, userCreds.channelName, userCreds.isSupergroup);
    const newRemoteId = `telegram://${result.channelId}/${result.messageId}`;

    await db.update(driveItems).set({
      storageRemoteId: newRemoteId,
      storageChannelName: userCreds.channelName,
      syncStatus: "synced",
      syncError: null,
      updatedAt: new Date(),
    }).where(eq(driveItems.id, id));

    // Clean up local staging file
    await unlink(localPath).catch(() => {});

    const [updated] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
    return c.json({ data: updated });
  } catch (err: any) {
    await db.update(driveItems).set({
      syncStatus: "error",
      syncError: err.message ?? "Sync failed",
      updatedAt: new Date(),
    }).where(eq(driveItems.id, id));

    return c.json({ error: "Internal Server Error", message: err.message ?? "Sync failed", statusCode: 500 }, 500);
  }
});

// Text file read
files.get("/:id/text", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  if (item.kind !== "file") {
    return c.json({ error: "Bad Request", message: "Not a file", statusCode: 400 }, 400);
  }

  const env = getEnv();
  if (item.size > env.TDRIVE_MAX_EDITOR_BYTES) {
    return c.json({ error: "Payload Too Large", message: "File too large for text editor", statusCode: 413 }, 413);
  }

  let content = "";

  if (item.storageRemoteId?.startsWith("local://")) {
    const localPath = resolveLocalPath(item.storageRemoteId);
    const buf = await readFile(localPath);
    content = buf.toString("utf8");
  } else if (item.storageRemoteId?.startsWith("telegram://")) {
    const userCreds = await getUserTelegramCreds(userId);
    if (!userCreds) {
      return c.json({ error: "Precondition Failed", message: "Telegram credentials not configured", statusCode: 412 }, 412);
    }
    const tgInfo = parseTelegramRemoteId(item.storageRemoteId);
    if (tgInfo) {
      const { buffer } = await downloadFile(userId, userCreds.creds, tgInfo.channelId, tgInfo.messageId);
      content = buffer.toString("utf8");
    }
  }

  return c.json({
    data: {
      id: item.id,
      name: item.name,
      content,
      mimeType: item.mimeType,
    },
  });
});

// Text file save
files.put("/:id/text", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = z.parse(
    z.object({ content: z.string().max(getEnv().TDRIVE_MAX_EDITOR_BYTES) }),
    await c.req.json()
  );

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) {
    return c.json({ error: "Not Found", message: "File not found", statusCode: 404 }, 404);
  }

  const contentBuf = Buffer.from(body.content, "utf8");

  if (item.storageRemoteId?.startsWith("local://")) {
    const localPath = resolveLocalPath(item.storageRemoteId);
    await writeFile(localPath, contentBuf);
  } else if (item.storageRemoteId?.startsWith("telegram://")) {
    // Re-upload to Telegram: delete old message, upload new
    const userCreds = await getUserTelegramCreds(userId);
    if (!userCreds) {
      return c.json({ error: "Precondition Failed", message: "Telegram credentials not configured", statusCode: 412 }, 412);
    }
    const tgInfo = parseTelegramRemoteId(item.storageRemoteId);
    if (tgInfo) {
      const { deleteMessage: tgDelete } = await import("../services/telegram/storage.js");
      await tgDelete(userId, userCreds.creds, tgInfo.channelId, tgInfo.messageId);
    }

    // Stage then upload
    const stagedPath = join(TEMP_DIR, randomUUID());
    await writeFile(stagedPath, contentBuf);
    const result = await uploadFile(userId, userCreds.creds, stagedPath, item.name, item.mimeType ?? undefined, undefined, userCreds.channelName, userCreds.isSupergroup);
    await unlink(stagedPath).catch(() => {});

    await db.update(driveItems).set({
      storageRemoteId: `telegram://${result.channelId}/${result.messageId}`,
      size: contentBuf.length,
      syncStatus: "synced",
      updatedAt: new Date(),
    }).where(eq(driveItems.id, id));

    const [updated] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
    return c.json({ data: updated });
  }

  // Local-only: just update size
  await db.update(driveItems).set({ size: contentBuf.length, updatedAt: new Date() }).where(eq(driveItems.id, id));
  const [updated] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  return c.json({ data: updated });
});

export default files;
