/**
 * Telegram file storage — upload/download files to a private channel.
 */
import { Api } from "telegram";
import { CustomFile } from "telegram/client/uploads.js";
import { getClient, resolveChannel, type TelegramCredentials } from "./client.js";
import { getEnv } from "../../env.js";
import { readFile, stat } from "node:fs/promises";

export interface UploadResult {
  messageId: number;
  channelId: number;
  fileSize: number;
}

/**
 * Upload a file to the user's storage channel.
 * Uses CustomFile with explicit filePath and buffer to satisfy gramJS requirements.
 */
export function uploadFile(
  userId: string,
  creds: TelegramCredentials,
  filePath: string,
  fileName: string,
  mimeType?: string,
  topicId?: number | string,
  targetChannelName?: string,
  isSupergroupMode: boolean = true
): Promise<UploadResult> {
  return (async () => {
    const env = getEnv();
    const client = await getClient(userId, creds);
    const channelName = targetChannelName || env.TDRIVE_STORAGE_CHANNEL;
    const channel = await resolveChannel(client, channelName, isSupergroupMode);

    if (!channel) {
      throw new Error(`Storage channel/supergroup "${channelName}" not found.`);
    }

    const buffer = await readFile(filePath);
    const fileStat = await stat(filePath);
    const customFile = new CustomFile(fileName, fileStat.size, filePath, buffer);

    const sendOptions: any = {
      file: customFile,
      forceDocument: true,
      attributes: [
        new Api.DocumentAttributeFilename({ fileName }),
      ],
      caption: `📄 File: ${fileName}\n🏷️ Type: ${mimeType ?? "application/octet-stream"}\n☁️ Stored via TDrive`,
    };

    // If uploading to Telegram Supergroup Forum Topic, pass replyTo topic ID
    if (topicId) {
      sendOptions.replyTo = typeof topicId === "string" ? parseInt(topicId, 10) : topicId;
    }

    const sent = await client.sendFile(channel, sendOptions);

    if (!(sent && "id" in sent)) {
      throw new Error("Upload failed: unexpected response from Telegram");
    }

    return {
      messageId: sent.id,
      channelId: Number(channel.id),
      fileSize: fileStat.size,
    };
  })();
}

/**
 * Download a file from Telegram by channel ID + message ID.
 * Returns a Buffer with the file contents.
 */
export async function downloadFile(
  userId: string,
  creds: TelegramCredentials,
  channelId: number,
  messageId: number,
  offset: number = 0,
  limit?: number
): Promise<{ buffer: Buffer; totalSize: number }> {
  const env = getEnv();
  const client = await getClient(userId, creds);
  const channel = await resolveChannel(client, env.TDRIVE_STORAGE_CHANNEL);

  const entity = channel || channelId;
  const messages = await client.getMessages(entity, { ids: [messageId] });
  const msg = messages[0];

  if (!msg || !msg.media) {
    throw new Error("Message not found or has no media in Telegram storage channel.");
  }

  let totalSize = 0;
  if ("document" in msg.media && msg.media.document) {
    totalSize = Number((msg.media.document as any).size ?? 0);
  }

  const opts: any = { offset, workers: 8 };
  if (limit && limit > 0) {
    opts.limit = limit;
  }

  const result = await client.downloadMedia(msg, opts);
  let buffer: Buffer;

  if (Buffer.isBuffer(result)) {
    buffer = result;
  } else if ((result as any) instanceof Uint8Array) {
    buffer = Buffer.from(result as any);
  } else if (typeof result === "string") {
    const { readFile: read } = await import("node:fs/promises");
    buffer = await read(result);
  } else {
    throw new Error("Failed to extract media buffer from Telegram response.");
  }

  if (totalSize === 0) totalSize = buffer.length;
  return { buffer, totalSize };
}

/**
 * Delete a message from the storage channel.
 */
export async function deleteMessage(
  userId: string,
  creds: TelegramCredentials,
  channelId: number,
  messageId: number
): Promise<void> {
  const client = await getClient(userId, creds);
  await client.deleteMessages(channelId, [messageId], { revoke: true });
}

/**
 * Check if user's storage channel exists.
 */
export async function checkStorageChannel(
  userId: string,
  creds: TelegramCredentials,
  targetChannelName?: string,
  isSupergroupMode: boolean = true
): Promise<{ exists: boolean; channelName: string }> {
  const env = getEnv();
  const name = targetChannelName || env.TDRIVE_STORAGE_CHANNEL;
  const client = await getClient(userId, creds);
  const channel = await resolveChannel(client, name, isSupergroupMode);
  return { exists: !!channel, channelName: name };
}
