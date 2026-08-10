/**
 * Telegram notifications — send text messages to the user via their MTProto session.
 * Delivery target: user's storage channel when resolvable, otherwise Saved Messages ("me").
 * All failures are silent (best-effort, never breaks the main flow).
 */
import { Api } from "telegram";
import { db } from "../../db/index.js";
import { appSettings } from "../../db/schema/app-settings.js";
import { eq } from "drizzle-orm";
import { getClient, resolveChannel, type TelegramCredentials } from "./client.js";
import { getEnv } from "../../env.js";

const NOTIFY_KEY_PREFIX = "tg_notify_";

/** Per-user notification toggle (default ON). */
export async function getNotificationEnabled(userId: string): Promise<boolean> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, NOTIFY_KEY_PREFIX + userId)).limit(1);
    return row ? (row.boolValue ?? true) : true;
  } catch {
    return true;
  }
}

export async function setNotificationEnabled(userId: string, enabled: boolean): Promise<boolean> {
  await db.insert(appSettings).values({ key: NOTIFY_KEY_PREFIX + userId, boolValue: enabled })
    .onConflictDoUpdate({ target: appSettings.key, set: { boolValue: enabled } });
  return enabled;
}

/**
 * Send a text notification to the user's Telegram.
 * Returns true when the message was accepted by Telegram.
 */
export async function sendTelegramNotification(
  userId: string,
  creds: TelegramCredentials,
  text: string,
  channelName?: string
): Promise<boolean> {
  try {
    const env = getEnv();
    const client = await getClient(userId, creds);

    // Prefer the user's storage channel; fall back to Saved Messages.
    let target: Api.Channel | string = "me";
    try {
      const name = channelName || env.TDRIVE_STORAGE_CHANNEL;
      if (name) {
        const channel = await resolveChannel(client, name, true);
        if (channel) target = channel;
      }
    } catch {
      target = "me";
    }

    await client.sendMessage(target, { message: text });
    return true;
  } catch (err) {
    console.error("[notifications] failed to send:", (err as Error).message);
    return false;
  }
}
