/**
 * Per-user Telegram Bot instance manager.
 * Each user has their own bot (via @BotFather).
 */
import { Bot } from "grammy";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/users.js";
import { botLinks, botChatStates } from "../../db/schema/bot.js";
import { eq } from "drizzle-orm";
import { decryptGlobal, encryptGlobal } from "../../lib/crypto.js";
import { newId } from "../../lib/utils.js";
import { registerBotCommands } from "./bot-commands.js";

const activeBots = new Map<string, Bot>();
const botPolling = new Map<string, Promise<void>>();

export interface BotInstance {
  bot: Bot;
  userId: string;
}

/**
 * Register a bot token for a user.
 */
export async function registerBot(userId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  // Validate token format
  if (!/^\d{8,10}:[A-Za-z0-9_-]{35,}$/.test(token)) {
    return { ok: false, error: "Invalid bot token format. Get one from @BotFather." };
  }

  // Stop existing bot if any
  await stopBot(userId);

  // Encrypt and save token
  const encrypted = encryptGlobal(token);
  await db.update(users).set({
    telegramBotTokenEncrypted: encrypted,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  // Start the bot
  return startBot(userId, token);
}

/**
 * Start a bot instance for a user.
 */
export async function startBot(userId: string, token?: string): Promise<{ ok: boolean; error?: string }> {
  if (activeBots.has(userId)) {
    return { ok: true }; // already running
  }

  // Get token from DB if not provided
  if (!token) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.telegramBotTokenEncrypted) {
      return { ok: false, error: "No bot token registered." };
    }
    token = decryptGlobal(user.telegramBotTokenEncrypted);
  }

  try {
    const bot = new Bot(token);
    registerBotCommands(bot, userId);

    // Prevent unhandled Grammy errors from crashing the process
    bot.catch = (err) => {
      console.error(`[Bot] Unhandled error for user ${userId}:`, err.message);
    };

    activeBots.set(userId, bot);

    // Start polling in background
    const pollingPromise = bot.start({
      onStart: () => console.log(`[Bot] Started for user ${userId}`),
      onStop: () => {
        console.log(`[Bot] Stopped for user ${userId}`);
        activeBots.delete(userId);
        botPolling.delete(userId);
      },
    }).catch((err) => {
      console.error(`[Bot] Polling error for user ${userId}:`, err.message);
      activeBots.delete(userId);
      botPolling.delete(userId);
    });

    botPolling.set(userId, pollingPromise);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Stop a bot instance for a user.
 */
export async function stopBot(userId: string): Promise<void> {
  const bot = activeBots.get(userId);
  if (bot) {
    bot.stop();
    activeBots.delete(userId);
    botPolling.delete(userId);
  }
}

/**
 * Unregister bot token for a user.
 */
export async function unregisterBot(userId: string): Promise<void> {
  await stopBot(userId);
  await db.update(users).set({
    telegramBotTokenEncrypted: null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

/**
 * Link a Telegram user to a TDrive user.
 */
export async function linkTelegramUser(
  tdriveUserId: string,
  telegramUserId: string,
  telegramUsername?: string,
  telegramFirstName?: string
): Promise<void> {
  // Check if already linked
  const [existing] = await db.select().from(botLinks)
    .where(eq(botLinks.telegramUserId, telegramUserId))
    .limit(1);

  if (existing) {
    // Update
    await db.update(botLinks).set({
      userId: tdriveUserId,
      telegramUsername: telegramUsername ?? existing.telegramUsername,
      telegramFirstName: telegramFirstName ?? existing.telegramFirstName,
    }).where(eq(botLinks.id, existing.id));
  } else {
    await db.insert(botLinks).values({
      id: newId(),
      userId: tdriveUserId,
      telegramUserId,
      telegramUsername,
      telegramFirstName,
    });
  }
}

/**
 * Get TDrive user ID from Telegram user ID.
 */
export async function getUserByTelegramId(telegramUserId: string): Promise<string | null> {
  const [link] = await db.select().from(botLinks)
    .where(eq(botLinks.telegramUserId, telegramUserId))
    .limit(1);
  return link?.userId ?? null;
}

/**
 * Get chat state for a user.
 */
export async function getChatState(telegramUserId: string) {
  const [state] = await db.select().from(botChatStates)
    .where(eq(botChatStates.telegramUserId, telegramUserId))
    .limit(1);
  return state;
}

/**
 * Set chat state for a user.
 */
export async function setChatState(
  telegramUserId: string,
  userId: string,
  chatId: string,
  state: string,
  stateData?: string
) {
  const [existing] = await db.select().from(botChatStates)
    .where(eq(botChatStates.telegramUserId, telegramUserId))
    .limit(1);

  if (existing) {
    await db.update(botChatStates).set({
      state,
      stateData: stateData ?? existing.stateData,
      lastActiveAt: new Date(),
    }).where(eq(botChatStates.id, existing.id));
  } else {
    await db.insert(botChatStates).values({
      id: newId(),
      userId,
      telegramUserId,
      chatId,
      state,
      stateData,
    });
  }
}

/**
 * Clear chat state (reset to idle).
 */
export async function clearChatState(telegramUserId: string) {
  await db.delete(botChatStates)
    .where(eq(botChatStates.telegramUserId, telegramUserId));
}

/**
 * Check if a bot is running for a user.
 */
export function isBotRunning(userId: string): boolean {
  return activeBots.has(userId);
}

/**
 * Get bot info from Telegram (name, username, description, etc).
 */
export async function getBotInfo(userId: string): Promise<Record<string, any> | null> {
  const bot = activeBots.get(userId);
  if (!bot) return null;
  try {
    const me = await bot.api.getMe();
    return {
      id: me.id,
      isBot: me.is_bot,
      firstName: me.first_name,
      username: me.username,
      canJoinGroups: me.can_join_groups,
      canReadMessages: me.can_read_all_group_messages,
      supportsInline: me.supports_inline_queries,
    };
  } catch {
    return null;
  }
}

/**
 * Get bot status for a user.
 */
export function getBotStatus(userId: string): { running: boolean } {
  return { running: activeBots.has(userId) };
}

/**
 * Start all bots on server boot (for users with tokens).
 */
export async function startAllBots(): Promise<void> {
  const usersWithBots = await db.select().from(users)
    .where(eq(users.telegramBotTokenEncrypted, ""));

  // Get all users with non-null bot tokens
  const allUsers = await db.select().from(users);
  const withTokens = allUsers.filter(u => u.telegramBotTokenEncrypted);

  console.log(`[BotManager] Starting bots for ${withTokens.length} users...`);

  for (const user of withTokens) {
    try {
      const token = decryptGlobal(user.telegramBotTokenEncrypted!);
      await startBot(user.id, token);
    } catch (err: any) {
      console.error(`[BotManager] Failed to start bot for user ${user.id}:`, err.message);
    }
  }
}

/**
 * Stop all bots on server shutdown.
 */
export async function stopAllBots(): Promise<void> {
  console.log(`[BotManager] Stopping ${activeBots.size} bots...`);
  for (const [userId, bot] of activeBots) {
    try {
      bot.stop();
    } catch {}
  }
  activeBots.clear();
  botPolling.clear();
}
