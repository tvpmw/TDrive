import { Hono } from "hono";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { users } from "../db/schema/users.js";
import { eq, and, isNull } from "drizzle-orm";
import { downloadFile, uploadFile } from "../services/telegram/index.js";
import { decryptGlobal } from "../lib/crypto.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { TelegramCredentials } from "../services/telegram/client.js";

export const webdav = new Hono();

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

// Basic WebDAV OPTIONS method
webdav.on("OPTIONS", "*", (c) => {
  return new Response(null, {
    status: 200,
    headers: {
      "DAV": "1, 2",
      "MS-Author-Via": "DAV",
      "Allow": "OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, MKCOL, COPY, MOVE",
    },
  });
});

// WebDAV PROPFIND method for listing files/folders for Windows File Explorer
webdav.on("PROPFIND", "*", async (c) => {
  const urlPath = decodeURIComponent(new URL(c.req.url).pathname.replace("/webdav", ""));
  const [firstUser] = await db.select().from(users).limit(1);
  if (!firstUser) {
    return c.text("No user found", 401);
  }

  const items = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, firstUser.id), isNull(driveItems.deletedAt)));

  let xml = `<?xml version="1.0" encoding="utf-8" ?>\n<D:multistatus xmlns:D="DAV:">\n`;

  // Add root directory
  xml += `  <D:response>\n`;
  xml += `    <D:href>/webdav/</D:href>\n`;
  xml += `    <D:propstat>\n`;
  xml += `      <D:prop>\n`;
  xml += `        <D:resourcetype><D:collection/></D:resourcetype>\n`;
  xml += `        <D:displayname>TDrive Root</D:displayname>\n`;
  xml += `      </D:prop>\n`;
  xml += `      <D:status>HTTP/1.1 200 OK</D:status>\n`;
  xml += `    </D:propstat>\n`;
  xml += `  </D:response>\n`;

  for (const item of items) {
    const isFolder = item.kind === "folder";
    const href = `/webdav/${encodeURIComponent(item.name)}${isFolder ? "/" : ""}`;

    xml += `  <D:response>\n`;
    xml += `    <D:href>${href}</D:href>\n`;
    xml += `    <D:propstat>\n`;
    xml += `      <D:prop>\n`;
    xml += `        <D:displayname>${item.name}</D:displayname>\n`;
    xml += `        <D:getcontentlength>${item.size}</D:getcontentlength>\n`;
    xml += `        <D:getlastmodified>${new Date(item.updatedAt).toUTCString()}</D:getlastmodified>\n`;
    if (isFolder) {
      xml += `        <D:resourcetype><D:collection/></D:resourcetype>\n`;
    } else {
      xml += `        <D:resourcetype/>\n`;
      xml += `        <D:getcontenttype>${item.mimeType || "application/octet-stream"}</D:getcontenttype>\n`;
    }
    xml += `      </D:prop>\n`;
    xml += `      <D:status>HTTP/1.1 200 OK</D:status>\n`;
    xml += `    </D:propstat>\n`;
    xml += `  </D:response>\n`;
  }

  xml += `</D:multistatus>`;

  return new Response(xml, {
    status: 207,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "DAV": "1, 2",
    },
  });
});
