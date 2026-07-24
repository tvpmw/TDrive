import { Hono } from "hono";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { users } from "../db/schema/users.js";
import { decryptGlobal } from "../lib/crypto.js";
import { getClient, resolveChannel, deleteForumTopic, type TelegramCredentials } from "../services/telegram/index.js";
import { getEnv } from "../env.js";

const trash = new Hono<{ Variables: Variables }>();

// List trashed items
trash.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
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
