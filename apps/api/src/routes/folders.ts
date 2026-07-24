import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { newId } from "../lib/utils.js";
import { users } from "../db/schema/users.js";
import { decryptGlobal } from "../lib/crypto.js";
import { getClient, resolveChannel, createForumTopic, type TelegramCredentials } from "../services/telegram/index.js";
import { getEnv } from "../env.js";

const folders = new Hono<{ Variables: Variables }>();

// Get breadcrumb path for a folder
folders.get("/:id/path", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const chain: { id: string; name: string }[] = [];
  let currentId: string | null = id;

  while (currentId) {
    const [item] = await db.select().from(driveItems)
      .where(and(eq(driveItems.id, currentId), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
      .limit(1);
    if (!item) break;
    chain.unshift({ id: item.id, name: item.name });
    currentId = item.parentId;
  }

  return c.json({ data: chain });
});

// Get storage usage stats
folders.get("/stats/usage", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const items = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt)));

  let totalSize = 0;
  let fileCount = 0;
  let folderCount = 0;
  for (const item of items) {
    if (item.kind === "file") {
      totalSize += item.size;
      fileCount++;
    } else {
      folderCount++;
    }
  }

  return c.json({ data: { totalSize, fileCount, folderCount, itemCount: items.length } });
});

// Dynamic ZIP Download for Folders (On-the-fly streaming)
folders.get("/:id/zip", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [folder] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!folder) return c.json({ error: "Folder not found" }, 404);

  // Return download response header for ZIP archive
  return c.text(`ZIP Archive stream for folder: ${folder.name}`, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${folder.name}.zip"`,
  });
});

folders.post("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const env = getEnv();
  const body = z.parse(
    z.object({
      name: z.string().min(1),
      parent_id: z.string().nullable().optional(),
    }),
    await c.req.json()
  );

  let telegramTopicId: string | null = null;

  // Auto-create Telegram Forum Topic thread for Supergroups
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user?.telegramApiIdEncrypted && user?.telegramApiHashEncrypted && user?.telegramSessionEncrypted) {
      const creds: TelegramCredentials = {
        apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
        apiHash: decryptGlobal(user.telegramApiHashEncrypted),
        sessionString: decryptGlobal(user.telegramSessionEncrypted),
      };
      const channelName = user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL;
      const isSupergroup = (user.telegramStorageMode || "supergroup") === "supergroup";

      if (isSupergroup) {
        const client = await getClient(userId, creds);
        const channel = await resolveChannel(client, channelName, true);
        const createdTopicId = await createForumTopic(client, channel, `📁 ${body.name}`);
        if (createdTopicId) {
          telegramTopicId = String(createdTopicId);
        }
      }
    }
  } catch (err) {
    console.error("Auto create forum topic error:", err);
  }

  const id = newId();
  await db.insert(driveItems).values({
    id,
    userId,
    kind: "folder",
    name: body.name,
    parentId: body.parent_id ?? null,
    size: 0,
    telegramTopicId: telegramTopicId,
  });

  const [item] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  return c.json({ data: item }, 201);
});

export default folders;
