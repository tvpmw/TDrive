import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { appSettings } from "../db/schema/app-settings.js";
import { eq, and, isNull, isNotNull, lt, inArray } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { users } from "../db/schema/users.js";
import { decryptGlobal } from "../lib/crypto.js";
import { getClient, resolveChannel, deleteForumTopic, type TelegramCredentials } from "../services/telegram/index.js";
import { getEnv } from "../env.js";

const trash = new Hono<{ Variables: Variables }>();

const PURGE_KEY = "trash_auto_purge";
const RETENTION_KEY = "trash_retention_days";

export async function getTrashRetention() {
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, [PURGE_KEY, RETENTION_KEY]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r]));
  return {
    enabled: map[PURGE_KEY]?.boolValue ?? false,
    days: map[RETENTION_KEY]?.numValue ?? 30,
  };
}

// Auto-purge lazy: hapus permanen item trash yang sudah melewati masa retensi
async function lazyPurge(userId: string) {
  const retention = await getTrashRetention();
  if (!retention.enabled) return 0;
  const cutoff = new Date(Date.now() - retention.days * 24 * 60 * 60 * 1000);
  const expired = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNotNull(driveItems.deletedAt), lt(driveItems.deletedAt, cutoff)));
  for (const item of expired) {
    await db.delete(driveItems).where(eq(driveItems.id, item.id));
  }
  return expired.length;
}

// Konfigurasi retensi trash (global, pola sama dengan registration_enabled)
trash.get("/retention", authMiddleware, async (c) => {
  return c.json({ data: await getTrashRetention() });
});

trash.put("/retention", authMiddleware, async (c) => {
  const body = z.parse(
    z.object({ enabled: z.boolean(), days: z.number().int().min(1).max(365) }),
    await c.req.json()
  );
  await db.insert(appSettings).values({ key: PURGE_KEY, boolValue: body.enabled })
    .onConflictDoUpdate({ target: appSettings.key, set: { boolValue: body.enabled } });
  await db.insert(appSettings).values({ key: RETENTION_KEY, numValue: body.days })
    .onConflictDoUpdate({ target: appSettings.key, set: { numValue: body.days } });
  return c.json({ data: { enabled: body.enabled, days: body.days } });
});

// List trashed items (dengan lazy auto-purge)
trash.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  await lazyPurge(userId);
  const items = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNotNull(driveItems.deletedAt)))
    .orderBy(driveItems.deletedAt);
  return c.json({ data: items });
});

// Restore from trash
trash.post("/:id/restore", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNotNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) return c.json({ error: "Not Found", message: "Item not found in trash", statusCode: 404 }, 404);

  await db.update(driveItems).set({ deletedAt: null, updatedAt: new Date() }).where(eq(driveItems.id, id));
  const [restored] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  return c.json({ data: restored });
});

// Permanent delete (single)
trash.delete("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const env = getEnv();

  const [item] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNotNull(driveItems.deletedAt)))
    .limit(1);

  if (!item) return c.json({ error: "Not Found", message: "Item not found", statusCode: 404 }, 404);

  // If item is a folder and has a Telegram Forum Topic ID, delete the entire Topic thread from Telegram
  if (item.kind === "folder" && item.telegramTopicId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user?.telegramApiIdEncrypted && user?.telegramApiHashEncrypted && user?.telegramSessionEncrypted) {
        const creds: TelegramCredentials = {
          apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
          apiHash: decryptGlobal(user.telegramApiHashEncrypted),
          sessionString: decryptGlobal(user.telegramSessionEncrypted),
        };
        const channelName = user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL;
        const client = await getClient(userId, creds);
        const channel = await resolveChannel(client, channelName, true);
        await deleteForumTopic(client, channel, parseInt(item.telegramTopicId, 10));
      }
    } catch (err) {
      console.error("Failed to delete Telegram Forum Topic on folder delete:", err);
    }
  }

  await db.delete(driveItems).where(eq(driveItems.id, id));
  return c.json({ job_ids: [] }, 202);
});

// Bulk permanent delete
trash.post("/bulk-permanent", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const env = getEnv();
  const body = await c.req.json<{ ids: string[] }>().catch(() => ({ ids: [] }));
  if (!body.ids?.length) {
    return c.json({ error: "Bad Request", message: "ids array required", statusCode: 400 }, 400);
  }

  const deleted: string[] = [];
  for (const id of body.ids) {
    const [item] = await db.select().from(driveItems)
      .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNotNull(driveItems.deletedAt)))
      .limit(1);

    if (item) {
      if (item.kind === "folder" && item.telegramTopicId) {
        try {
          const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          if (user?.telegramApiIdEncrypted && user?.telegramApiHashEncrypted && user?.telegramSessionEncrypted) {
            const creds: TelegramCredentials = {
              apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
              apiHash: decryptGlobal(user.telegramApiHashEncrypted),
              sessionString: decryptGlobal(user.telegramSessionEncrypted),
            };
            const channelName = user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL;
            const client = await getClient(userId, creds);
            const channel = await resolveChannel(client, channelName, true);
            await deleteForumTopic(client, channel, parseInt(item.telegramTopicId, 10));
          }
        } catch {}
      }
      await db.delete(driveItems).where(eq(driveItems.id, id));
      deleted.push(id);
    }
  }

  return c.json({ data: { deleted, count: deleted.length } });
});

// Empty trash
trash.delete("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const env = getEnv();
  const trashed = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNotNull(driveItems.deletedAt)));

  for (const item of trashed) {
    if (item.kind === "folder" && item.telegramTopicId) {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user?.telegramApiIdEncrypted && user?.telegramApiHashEncrypted && user?.telegramSessionEncrypted) {
          const creds: TelegramCredentials = {
            apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
            apiHash: decryptGlobal(user.telegramApiHashEncrypted),
            sessionString: decryptGlobal(user.telegramSessionEncrypted),
          };
          const channelName = user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL;
          const client = await getClient(userId, creds);
          const channel = await resolveChannel(client, channelName, true);
          await deleteForumTopic(client, channel, parseInt(item.telegramTopicId, 10));
        }
      } catch {}
    }
    await db.delete(driveItems).where(eq(driveItems.id, item.id));
  }

  return c.json({ job_ids: [] }, 202);
});

export default trash;
