import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { newId } from "../lib/utils.js";
import { users } from "../db/schema/users.js";
import { decryptGlobal } from "../lib/crypto.js";
import { getClient, resolveChannel, createForumTopic, downloadFile, type TelegramCredentials } from "../services/telegram/index.js";
import { getEnv } from "../env.js";
import { emitActivity } from "../lib/event-bus.js";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

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

// Treemap: hierarki folder + file dengan ukuran rekursif (untuk visualisasi storage)
folders.get("/treemap", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const items = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt)));

  interface Node {
    id: string;
    name: string;
    kind: "file" | "folder";
    size: number;
    fileCount: number;
    mimeType: string | null;
    children: Node[];
  }

  const byId = new Map<string, Node>();
  const roots: Node[] = [];
  for (const item of items) {
    const node: Node = {
      id: item.id,
      name: item.name,
      kind: item.kind as "file" | "folder",
      size: item.kind === "file" ? item.size : 0,
      fileCount: item.kind === "file" ? 1 : 0,
      mimeType: item.mimeType ?? null,
      children: [],
    };
    byId.set(item.id, node);
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.children.push(node);
    } else if (item.parentId) {
      // parent mungkin belum diproses — simpan sementara
      (node as any)._pendingParent = item.parentId;
      roots.push(node);
    } else {
      roots.push(node);
    }
  }

  // Selesaikan penempatan parent yang tertunda + agregasi ukuran rekursif
  const attach = (node: Node, depth = 0): void => {
    const pending = (node as any)._pendingParent as string | undefined;
    if (pending && byId.has(pending)) {
      const parent = byId.get(pending)!;
      parent.children.push(node);
      const idx = roots.indexOf(node);
      if (idx >= 0) roots.splice(idx, 1);
    }
    delete (node as any)._pendingParent;
    let size = node.size;
    let count = node.fileCount;
    for (const child of node.children) {
      attach(child, depth + 1);
      size += child.size;
      count += child.fileCount;
    }
    node.size = size;
    node.fileCount = count;
  };
  for (const root of roots) attach(root);

  const sortBySize = (nodes: Node[]): Node[] => {
    for (const n of nodes) sortBySize(n.children);
    return nodes.sort((a, b) => b.size - a.size);
  };
  sortBySize(roots);
  return c.json({ data: { totalSize: roots.reduce((s, n) => s + n.size, 0), roots } });
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

// ── Minimal ZIP writer (store method, CRC32) — tanpa dependency eksternal ──
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipDateTime(d: Date): { dosTime: number; dosDate: number } {
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { dosTime, dosDate };
}

// Sanitasi nama entri ZIP: cegah path traversal (zip-slip) & path absolut
function sanitizeZipPath(parts: string[]): string | null {
  const clean: string[] = [];
  for (let part of parts) {
    part = part.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
    if (!part || part === ".") continue;
    if (part === "..") return null; // traversal → tolak
    if (/^[a-zA-Z]:/.test(part)) continue; // drive letter → buang prefix
    clean.push(part);
  }
  return clean.join("/") || null;
}

// Build ZIP in memory (stored entries) from [{ name, buffer, mtime }]
export function buildZip(entries: { name: string; buffer: Buffer; mtime: Date }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const { dosTime, dosDate } = zipDateTime(entry.mtime);
    const crc = crc32(entry.buffer);
    const size = entry.buffer.length;

    // Local file header
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags (UTF-8)
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    chunks.push(local, nameBuf, entry.buffer);

    // Central directory record
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); // version made by
    cen.writeUInt16LE(20, 6); // version needed
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10); // method
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(size, 20);
    cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30); // extra
    cen.writeUInt16LE(0, 32); // comment
    cen.writeUInt16LE(0, 34); // disk
    cen.writeUInt16LE(0, 36); // internal attrs
    cen.writeUInt32LE(0, 38); // external attrs
    cen.writeUInt32LE(offset, 42); // local header offset
    central.push(Buffer.concat([cen, nameBuf]));

    offset += 30 + nameBuf.length + size;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(central);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); // total entries (disk 0)
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...chunks, centralBuf, eocd]);
}

function resolveLocalPath(remoteId: string): string {
  const filename = remoteId.replace("local://", "");
  const candidates = [
    resolve("./storage-temp"),
    resolve("./apps/api/storage-temp"),
    resolve("../../storage-temp"),
  ];
  for (const dir of candidates) {
    const p = join(dir, filename);
    if (existsSync(p)) return p;
  }
  return join(resolve("./storage-temp"), filename);
}

async function resolveUserCreds(userId: string) {
  const env = getEnv();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) return null;
  return {
    creds: {
      apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
      apiHash: decryptGlobal(user.telegramApiHashEncrypted),
      sessionString: decryptGlobal(user.telegramSessionEncrypted),
    } as TelegramCredentials,
    channelName: user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL,
    isSupergroup: (user.telegramStorageMode || "supergroup") === "supergroup",
  };
}

// Ambil buffer file dari local staging atau Telegram
export async function fetchFileBuffer(userId: string, item: typeof driveItems.$inferSelect) {
  const remoteId = item.storageRemoteId ?? "";
  if (remoteId.startsWith("local://")) {
    const p = resolveLocalPath(remoteId);
    if (existsSync(p)) return await readFile(p);
  }
  if (remoteId.startsWith("telegram://")) {
    const clean = remoteId.replace(/^telegram:\/\//, "");
    const [channelIdStr, messageIdStr] = clean.split("/");
    const channelId = parseInt(channelIdStr, 10);
    const messageId = parseInt(messageIdStr, 10);
    if (!isNaN(channelId) && !isNaN(messageId)) {
      const creds = await resolveUserCreds(userId);
      if (creds) {
        const { buffer } = await downloadFile(userId, creds.creds, channelId, messageId, 0, undefined, creds.channelName, creds.isSupergroup);
        return buffer;
      }
    }
  }
  return null;
}

// Dynamic ZIP Download for Folders — rekursif, ambil semua file + subfolder
folders.get("/:id/zip", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [folder] = await db.select().from(driveItems)
    .where(and(eq(driveItems.id, id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
    .limit(1);

  if (!folder) return c.json({ error: "Folder not found" }, 404);

  // Kumpulkan semua item di dalam folder (rekursif)
  const entries: { name: string; buffer: Buffer; mtime: Date }[] = [];
  const queue: { id: string; prefix: string }[] = [{ id, prefix: folder.name }];
  let skipped = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = await db.select().from(driveItems)
      .where(and(eq(driveItems.parentId, current.id), eq(driveItems.userId, userId), isNull(driveItems.deletedAt)))
      .orderBy(driveItems.kind);

    for (const child of children) {
      const sanitized = sanitizeZipPath([current.prefix, child.name]);
      if (!sanitized) { skipped++; continue; }
      const relPath = sanitized;
      if (child.kind === "folder") {
        queue.push({ id: child.id, prefix: relPath });
      } else {
        const buf = await fetchFileBuffer(userId, child).catch(() => null);
        if (buf) {
          entries.push({ name: relPath, buffer: buf, mtime: child.updatedAt ?? new Date() });
        } else {
          skipped++;
        }
      }
    }
  }

  if (entries.length === 0) {
    return c.json({ error: "Empty", message: skipped > 0 ? "File tidak dapat diunduh" : "Folder kosong", statusCode: 400 }, 400);
  }

  // Guard ukuran: cegah OOM untuk folder raksasa (maks ~400MB per ZIP)
  const totalBytes = entries.reduce((a, e) => a + e.buffer.length, 0);
  if (totalBytes > 400 * 1024 * 1024) {
    return c.json({ error: "Payload Too Large", message: "Folder terlalu besar untuk ZIP (maks 400MB)", statusCode: 413 }, 413);
  }

  const zip = buildZip(entries);
  const safeName = folder.name.replace(/[^\w\-. ]+/g, "_").trim() || "folder";
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
      "Content-Length": String(zip.length),
    },
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
  emitActivity({
    type: "folder.created",
    message: `Folder “${body.name}” dibuat`,
    itemName: body.name,
    userId,
  });
  return c.json({ data: item }, 201);
});

export default folders;
