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
  // Search user's recent dialogs for matching Channel or Supergroup Megagroup
  const dialogs = await client.getDialogs({ limit: 150 });
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
 * Find a channel/supergroup by name WITHOUT creating it.
 * Returns null if not found. Safe for download/upload where you don't want auto-create.
 */
export async function findChannel(
  client: TelegramClient,
  channelName: string
): Promise<Api.Channel | null> {
  try {
    const dialogs = await client.getDialogs({ limit: 300 });
    for (const dialog of dialogs) {
      if ((dialog.isChannel || dialog.isGroup) && dialog.title === channelName) {
        return dialog.entity as Api.Channel;
      }
    }
  } catch {}
  return null;
}

/**
 * Get all forum topics from a supergroup.
 * Returns array of { id, title, messageCount, iconColor }.
 */
export async function getForumTopics(
  client: TelegramClient,
  channel: Api.Channel
): Promise<Array<{ id: number; title: string; messageCount?: number; iconColor?: number }>> {
  try {
    const result = await client.invoke(
      new Api.channels.GetForumTopics({
        channel,
        offsetDate: 0,
        offsetId: 0,
        offsetTopic: 0,
        limit: 100,
      })
    );

    if (result && "topics" in result && Array.isArray(result.topics)) {
      return result.topics
        .filter((t: any) => t.id !== 1) // Exclude "General" topic (ID=1)
        .map((t: any) => ({
          id: t.id,
          title: t.title || "Untitled",
          iconColor: t.icon_color,
        }));
    }
  } catch (err) {
    console.error("[client] Failed to get forum topics:", err);
  }
  return [];
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
