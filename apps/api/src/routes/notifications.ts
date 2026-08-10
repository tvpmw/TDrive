import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { eq } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { decryptGlobal } from "../lib/crypto.js";
import { getNotificationEnabled, setNotificationEnabled, sendTelegramNotification } from "../services/telegram/notifications.js";
import { getEnv } from "../env.js";

const notifications = new Hono<{ Variables: Variables }>();

// GET /api/notifications — status toggle notifikasi user
notifications.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const enabled = await getNotificationEnabled(userId);
  return c.json({ data: { enabled } });
});

// PUT /api/notifications — aktif/nonaktifkan notifikasi
notifications.put("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(z.object({ enabled: z.boolean() }), await c.req.json());
  const enabled = await setNotificationEnabled(userId, body.enabled);
  return c.json({ data: { enabled } });
});

// POST /api/notifications/test — kirim pesan uji ke Telegram user
notifications.post("/test", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const env = getEnv();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted || !user?.telegramSessionEncrypted) {
    return c.json({ error: "Bad Request", message: "Telegram belum terhubung", statusCode: 400 }, 400);
  }

  const creds = {
    apiId: Number(decryptGlobal(user.telegramApiIdEncrypted)),
    apiHash: decryptGlobal(user.telegramApiHashEncrypted),
    sessionString: decryptGlobal(user.telegramSessionEncrypted),
  };

  const sent = await sendTelegramNotification(
    userId,
    creds,
    "🔔 TDrive — Notifikasi aktif! Anda akan menerima info saat upload selesai atau gagal.",
    user.telegramStorageChannelName || env.TDRIVE_STORAGE_CHANNEL
  );

  if (!sent) return c.json({ error: "Failed", message: "Gagal mengirim pesan uji", statusCode: 502 }, 502);
  return c.json({ data: { sent: true } });
});

export default notifications;
