/**
 * Telegram MTProto client manager.
 * Maintains one active client per-user. Callers must pass decrypted credentials.
 */
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { getEnv } from "../../env.js";

const clients = new Map<string, TelegramClient>();

export interface TelegramCredentials {
  apiId: number;
  apiHash: string;
  sessionString: string;
}

export async function getClient(userId: string, creds: TelegramCredentials): Promise<TelegramClient> {
  const existing = clients.get(userId);
  if (existing) return existing;

  const client = new TelegramClient(
    new StringSession(creds.sessionString),
    creds.apiId,
    creds.apiHash,
    {
      connectionRetries: 5,
      autoReconnect: true,
    }
  );

  if (!client.connected) {
    await client.connect();
  }

  clients.set(userId, client);
  return client;
}

export function removeClient(userId: string) {
  const client = clients.get(userId);
  if (client) {
    client.disconnect().catch(() => {});
    clients.delete(userId);
  }
}

/**
 * Resolve storage channel entity by name or username.
 * Looks in user's dialogs first, falls back to resolvePeer.
 * Auto-creates the channel if not found.
 */
export async function resolveChannel(
  client: TelegramClient,
  channelName: string,
  isSupergroupMode: boolean = true
): Promise<Api.Channel> {
  // Search user's dialogs for matching Channel or Supergroup Megagroup
  const dialogs = await client.getDialogs({});
  for (const dialog of dialogs) {
    if ((dialog.isChannel || dialog.isGroup) && dialog.title === channelName) {
      return dialog.entity as Api.Channel;
    }
  }

  // Auto-create Supergroup Megagroup (with Forum Topics support)
  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title: channelName,
      about: "TDrive Cloud Storage (Forum Topics Enabled)",
      megagroup: isSupergroupMode, // true = Supergroup, false = Broadcast channel
      forum: isSupergroupMode,     // enable Telegram Forum Topics
    })
  );

  if ("chats" in result && Array.isArray(result.chats) && result.chats.length > 0) {
    const channelEntity = result.chats[0] as Api.Channel;

    // Enable Forum Topics feature on the newly created Supergroup
    if (isSupergroupMode) {
      try {
        await client.invoke(
          new Api.channels.ToggleForum({
            channel: channelEntity,
            enabled: true,
          })
        );
      } catch {}
    }

    return channelEntity;
  }

  throw new Error(`Failed to auto-create storage ${isSupergroupMode ? "Supergroup" : "Channel"} "${channelName}"`);
}

/**
 * Create a new Telegram Forum Topic thread for a TDrive Folder.
 * Returns the created topic ID (replyTo / message ID).
 */
export async function createForumTopic(
  client: TelegramClient,
  channel: Api.Channel,
  topicTitle: string
): Promise<number | null> {
  try {
    const res = await client.invoke(
      new Api.channels.CreateForumTopic({
        channel,
        title: topicTitle,
      })
    );

    if (res && "updates" in res && Array.isArray(res.updates)) {
      for (const update of res.updates) {
        if ("id" in update && typeof update.id === "number") {
          return update.id;
        }
      }
    }
  } catch (err) {
    console.error("Failed to create Telegram Forum Topic:", err);
  }
  return null;
}

/**
 * Delete a Telegram Forum Topic thread permanently from Supergroup.
 */
export async function deleteForumTopic(
  client: TelegramClient,
  channel: Api.Channel,
  topicId: number
): Promise<boolean> {
  try {
    await client.invoke(
      new Api.channels.DeleteTopicHistory({
        channel,
        topMsgId: topicId,
      })
    );
    return true;
  } catch (err) {
    console.error("Failed to delete Telegram Forum Topic:", err);
    return false;
  }
}
