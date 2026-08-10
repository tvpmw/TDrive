import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { users } from "../db/schema/users.js";
import { eq, and, isNull, desc, ilike, inArray, sql } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { newId } from "../lib/utils.js";
import { getEnv } from "../env.js";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile, unlink, stat, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { decryptGlobal } from "../lib/crypto.js";
import { uploadFile, downloadFile } from "../services/telegram/index.js";
import { getNotificationEnabled, sendTelegramNotification } from "../services/telegram/notifications.js";
import { enqueueSync } from "../queue/index.js";
import { emitActivity } from "../lib/event-bus.js";
import { fileRevisions } from "../db/schema/advanced-features.js";
import { nanoid } from "nanoid";
import type { TelegramCredentials } from "../services/telegram/client.js";
import { EDITABLE_EXTENSIONS } from "@tdrive/shared";
import { buildZip, fetchFileBuffer } from "./folders.js";

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
// Ringkasan semua tag & koleksi milik user (untuk filter chip di drive)
files.get("/tags/summary", authMiddleware, async (c) => {
  const userId = c.get("userId");
  // Hanya ambil rows yang benar-benar punya tags/collections (bukan load semua item)
  const rows = await db.select({ tags: driveItems.tags, collections: driveItems.collections })
    .from(driveItems)
    .where(
      and(
        eq(driveItems.userId, userId),
        isNull(driveItems.deletedAt),
        sql`(COALESCE(${driveItems.tags},'') <> '' OR COALESCE(${driveItems.collections},'') <> '')`
      )
    );

  const tagMap = new Map<string, number>();
  const collMap = new Map<string, number>();
  for (const row of rows) {
    for (const t of (row.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    }
    for (const c of (row.collections ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      collMap.set(c, (collMap.get(c) ?? 0) + 1);
    }
  }
  const tags = Array.from(tagMap.entries()).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const collections = Array.from(collMap.entries()).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return c.json({ data: { tags, collections } });
});

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
  // E2EE metadata (client-side encryption — server only stores ciphertext + IV/salt)
  const isEncrypted = formData.get("is_encrypted") === "1" || formData.get("is_encrypted") === "true";
  const encryptionIv = (formData.get("encryption_iv") as string | null) ?? null;
  const keySalt = (formData.get("key_salt") as string | null) ?? null;

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

  // File Versioning: if a file with the same name exists in the same folder,
  // save the old content as a revision and replace the item in place (Google-Drive style).
  const sameNameWhere = parentId
    ? and(eq(driveItems.userId, userId), eq(driveItems.kind, "file"), eq(driveItems.name, file.name), eq(driveItems.parentId, parentId), isNull(driveItems.deletedAt))
    : and(eq(driveItems.userId, userId), eq(driveItems.kind, "file"), eq(driveItems.name, file.name), isNull(driveItems.parentId), isNull(driveItems.deletedAt));

  const [sameNameItem] = await db.select().from(driveItems).where(sameNameWhere).limit(1);

  if (sameNameItem) {
    if (sameNameItem.fileHash === fileHash) {
      // Konten identik — anggap upload instan, tanpa revisi baru
      emitActivity({
        type: "file.uploaded",
        message: `File “${sameNameItem.name}” diunggah (konten identik)`,
        itemName: sameNameItem.name,
        userId,
      });
      return c.json({ data: sameNameItem, instantUpload: true }, 201);
    }

    // Simpan state lama sebagai revisi
    const [lastRev] = await db.select().from(fileRevisions)
      .where(eq(fileRevisions.itemId, sameNameItem.id))
      .orderBy(desc(fileRevisions.revisionNumber))
      .limit(1);
    const revNumber = (lastRev?.revisionNumber ?? 0) + 1;

    await db.insert(fileRevisions).values({
      id: nanoid(24),
      itemId: sameNameItem.id,
      revisionNumber: revNumber,
      size: sameNameItem.size,
      telegramMessageId: sameNameItem.storageRemoteId ?? null,
      storageRemoteId: sameNameItem.storageRemoteId ?? null,
      storageProvider: sameNameItem.storageProvider ?? null,
      fileHash: sameNameItem.fileHash ?? null,
      createdBy: userId,
    });

    // Ganti konten item yang sama (id tetap, remote baru)
    await writeFile(stagedPath, buffer);
    await db.update(driveItems).set({
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      storageProvider: "local",
      storageRemoteId: remoteId,
      storageChannelName: "TeleDrive Storage",
      syncStatus: "local",
      fileHash,
      isEncrypted: isEncrypted ? 1 : sameNameItem.isEncrypted ?? 0,
      encryptionIv: isEncrypted ? encryptionIv : sameNameItem.encryptionIv,
      keySalt: isEncrypted ? keySalt : sameNameItem.keySalt,
      updatedAt: new Date(),
    }).where(eq(driveItems.id, sameNameItem.id));

    const [item] = await db.select().from(driveItems).where(eq(driveItems.id, sameNameItem.id)).limit(1);
    const createdItem = item;
    runBackgroundSync(userId, createdItem, stagedPath);

    emitActivity({
      type: "file.uploaded",
      message: `File “${createdItem.name}” diunggah (versi ${revNumber + 1})`,
      itemName: createdItem.name,
      userId,
    });
    return c.json({ data: createdItem, versioned: true, revisionNumber: revNumber + 1 }, 201);
  }

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
      // Salin metadata E2EE agar salinan duplikat tetap bisa didekripsi
      isEncrypted: existingFile.isEncrypted ?? 0,
      encryptionIv: existingFile.isEncrypted ? existingFile.encryptionIv : null,
      keySalt: existingFile.isEncrypted ? existingFile.keySalt : null,
    });

    const [item] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
    emitActivity({
      type: "file.uploaded",
      message: `File “${item?.name ?? file.name}” diunggah (duplikat terdeteksi)`,
      itemName: item?.name ?? file.name,
      userId,
    });
    return c.json({ data: item, instantUpload: true }, 201);
  }

  await writeFile(stagedPath, buffer);

  const id = newId();
  await db.insert(driveItems).values({
    id,
    userId,
    kind: "file",
    name: file.name,
    parentId: parentId || null,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    storageProvider: "local",
    storageRemoteId: remoteId,
    storageChannelName: "TeleDrive Storage",
    syncStatus: "local",
    fileHash: fileHash,
    isEncrypted: isEncrypted ? 1 : 0,
    encryptionIv: isEncrypted ? encryptionIv : null,
    keySalt: isEncrypted ? keySalt : null,
  });

  const [item] = await db.select().from(driveItems).where(eq(driveItems.id, id)).limit(1);
  const createdItem = item;
  runBackgroundSync(userId, createdItem, stagedPath);

  emitActivity({
    type: "file.uploaded",
    message: `File “${createdItem.name}” diunggah`,
    itemName: createdItem.name,
    userId,
  });
  return c.json({ data: createdItem }, 201);
});

// Bulk: download beberapa file sekaligus sebagai ZIP
files.post("/bulk/zip", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({ ids: z.array(z.string()).min(1).max(200) }),
    await c.req.json()
  );
  const selected = await db.select().from(driveItems).where(
    and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt), eq(driveItems.kind, "file"), inArray(driveItems.id, body.ids))
  );
  if (selected.length === 0) return c.json({ error: "Bad Request", message: "Tidak ada file yang dipilih" }, 400);

  const entries: { name: string; buffer: Buffer; mtime: Date }[] = [];
  let total = 0;
  for (const item of selected) {
    const buf = await fetchFileBuffer(userId, item).catch(() => null);
    if (!buf) continue;
    total += buf.length;
    if (total > 400 * 1024 * 1024) break; // guard 400MB
    entries.push({ name: item.name, buffer: buf, mtime: new Date(item.updatedAt) });
  }
  if (entries.length === 0) return c.json({ error: "Not Found", message: "File tidak tersedia" }, 404);

  const zip = buildZip(entries);
  emitActivity({
    type: "file.uploaded",
    message: `${entries.length} file diunduh sebagai ZIP`,
    userId,
  });
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tdrive-bulk-${Date.now()}.zip"`,
      "Content-Length": String(zip.length),
    },
  });
});

// Bulk: duplikasi banyak item sekaligus
files.post("/bulk/duplicate", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({ ids: z.array(z.string()).min(1).max(200) }),
    await c.req.json()
  );
  const selected = await db.select().from(driveItems).where(
    and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt), inArray(driveItems.id, body.ids))
  );
  let created = 0;
  for (const item of selected) {
    await db.insert(driveItems).values({
      ...item,
      id: newId(),
      name: `${item.name} (Copy)`,
      shareToken: null,
      sharePasswordHash: null,
      shareExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created++;
  }
  return c.json({ data: { duplicated: created } });
});

// Bulk: set tags & collections untuk banyak item
files.post("/bulk/tags", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({ ids: z.array(z.string()).min(1).max(200), tags: z.string().nullable().optional(), collections: z.string().nullable().optional() }),
    await c.req.json()
  );
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.collections !== undefined) updates.collections = body.collections;
  const rows = await db.select({ id: driveItems.id }).from(driveItems).where(
    and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt), inArray(driveItems.id, body.ids))
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return c.json({ error: "Bad Request", message: "Tidak ada item yang dipilih" }, 400);
  // Single UPDATE dengan IN clause — satu round-trip DB untuk semua item
  await db.update(driveItems).set(updates).where(
    and(eq(driveItems.userId, userId), inArray(driveItems.id, ids))
  );
  return c.json({ data: { updated: ids.length } });
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

// Background Telegram sync — fire-and-forget with best-effort error capture.
// Shared by fresh uploads and versioned (same-name replace) uploads.
function runBackgroundSync(
  userId: string,
  createdItem: { id: string; name: string; mimeType: string | null; parentId: string | null; size: number } | null | undefined,
  stagedPath: string
) {
  if (!createdItem) return;
  Promise.resolve().then(async () => {
    const userCredsForSync = await getUserTelegramCreds(userId).catch(() => null);
    if (!userCredsForSync) return;
    try {
      let topicId: string | number | undefined = undefined;
      if (createdItem.parentId) {
        const [parentFolder] = await db.select().from(driveItems).where(eq(driveItems.id, createdItem.parentId)).limit(1);
        if (parentFolder?.telegramTopicId) topicId = parentFolder.telegramTopicId;
      }
      const result = await uploadFile(
        userId,
        userCredsForSync.creds,
        stagedPath,
        createdItem.name,
        createdItem.mimeType ?? undefined,
        topicId,
        userCredsForSync.channelName,
        userCredsForSync.isSupergroup
      );
      await db.update(driveItems).set({
        storageProvider: userCredsForSync.isSupergroup ? "telegram-supergroup-topic" : "telegram-private-channel",
        storageRemoteId: `telegram://${result.channelId}/${result.messageId}`,
        storageChannelName: userCredsForSync.channelName || "TeleDrive Storage",
        syncStatus: "synced",
        updatedAt: new Date(),
      }).where(eq(driveItems.id, createdItem.id));
      await unlink(stagedPath).catch(() => {});
      // Notifikasi upload selesai (best-effort)
      if (await getNotificationEnabled(userId)) {
        const sizeMB = ((createdItem.size || 0) / 1024 / 1024).toFixed(2);
        sendTelegramNotification(
          userId,
          userCredsForSync.creds,
          `✅ TDrive — Upload selesai\n📄 ${createdItem.name}\n📦 ${sizeMB} MB`,
          userCredsForSync.channelName
        ).catch(() => {});
      }
    } catch (err: any) {
      await db.update(driveItems).set({
        syncStatus: "sync_failed",
        syncError: err?.message || "Sync failed",
        updatedAt: new Date(),
      }).where(eq(driveItems.id, createdItem.id));
      await unlink(stagedPath).catch(() => {});
      // Notifikasi upload gagal (best-effort)
      if (await getNotificationEnabled(userId)) {
        sendTelegramNotification(
          userId,
          userCredsForSync.creds,
          `❌ TDrive — Upload gagal\n📄 ${createdItem.name}\n⚠️ ${err?.message || "Sync error"}`,
          userCredsForSync.channelName
        ).catch(() => {});
      }
    }
  }).catch(() => {});
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

        const { buffer, totalSize } = await downloadFile(targetUserId, userCreds.creds, tgInfo.channelId, tgInfo.messageId, start, chunkSize, userCreds.channelName, userCreds.isSupergroup);
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

      const { buffer, totalSize } = await downloadFile(targetUserId, userCreds.creds, tgInfo.channelId, tgInfo.messageId, 0, undefined, userCreds.channelName, userCreds.isSupergroup);
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
      tags: z.string().nullable().optional(),
      collections: z.string().nullable().optional(),
      is_starred: z.number().min(0).max(1).optional(),
    }),
    await c.req.json()
  );

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.parent_id !== undefined) updates.parentId = body.parent_id;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.collections !== undefined) updates.collections = body.collections;
  if (body.is_starred !== undefined) updates.isStarred = body.is_starred;

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
  emitActivity({
    type: "file.deleted",
    message: `File “${item.name}” dipindah ke Trash`,
    itemName: item.name,
    userId,
  });
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
      const { buffer } = await downloadFile(userId, userCreds.creds, tgInfo.channelId, tgInfo.messageId, 0, undefined, userCreds.channelName, userCreds.isSupergroup);
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
