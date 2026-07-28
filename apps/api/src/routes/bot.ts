import { Hono } from "hono";
import { z } from "zod/v4";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { botLinks } from "../db/schema/bot.js";
import { eq } from "drizzle-orm";
import { decryptGlobal } from "../lib/crypto.js";
import {
  registerBot,
  unregisterBot,
  stopBot,
  startBot,
  isBotRunning,
  getBotStatus,
  getBotInfo,
} from "../services/telegram/bot-manager.js";

export const botRoutes = new Hono<{ Variables: Variables }>();

// Get bot status
botRoutes.get("/status", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const running = isBotRunning(userId);
  const hasToken = !!user?.telegramBotTokenEncrypted;
  const botInfo = running ? await getBotInfo(userId) : null;

  // Get linked Telegram accounts
  const links = await db.select().from(botLinks).where(eq(botLinks.userId, userId));

  return c.json({
    data: {
      running,
      hasToken,
      botInfo,
      linkedAccounts: links.map((l) => ({
        telegramUserId: l.telegramUserId,
        username: l.telegramUsername,
        firstName: l.telegramFirstName,
        linkedAt: l.linkedAt,
      })),
    },
  });
});

// Register bot token
botRoutes.post("/register", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({ token: z.string().min(1) }),
    await c.req.json()
  );

  const result = await registerBot(userId, body.token);

  if (!result.ok) {
    return c.json({ error: "Bad Request", message: result.error, statusCode: 400 }, 400);
  }

  return c.json({ data: { success: true, running: true } });
});

// Unregister bot
botRoutes.delete("/unregister", authMiddleware, async (c) => {
  const userId = c.get("userId");
  await unregisterBot(userId);
  return c.json({ data: { success: true } });
});

// Restart bot
botRoutes.post("/restart", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user?.telegramBotTokenEncrypted) {
    return c.json({ error: "Bad Request", message: "No bot token registered", statusCode: 400 }, 400);
  }

  await stopBot(userId);
  const result = await startBot(userId);

  if (!result.ok) {
    return c.json({ error: "Internal Server Error", message: result.error, statusCode: 500 }, 500);
  }

  return c.json({ data: { success: true, running: true } });
});

// Get allowed IDs
botRoutes.get("/allowed-ids", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const ids = user?.telegramAllowedIds?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return c.json({ data: { allowedIds: ids } });
});

// Update allowed IDs
botRoutes.put("/allowed-ids", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({ allowedIds: z.array(z.string()) }),
    await c.req.json()
  );
  const csv = body.allowedIds.map((s) => s.trim()).filter(Boolean).join(",");
  await db.update(users).set({ telegramAllowedIds: csv, updatedAt: new Date() }).where(eq(users.id, userId));
  return c.json({ data: { success: true, allowedIds: body.allowedIds } });
});
