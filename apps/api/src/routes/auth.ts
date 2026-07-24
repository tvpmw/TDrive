import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { appSettings } from "../db/schema/app-settings.js";
import { eq, count } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/bcrypt.js";
import { signToken } from "../lib/jwt.js";
import { encryptGlobal, decryptGlobal } from "../lib/crypto.js";
import { getEnv } from "../env.js";
import { newId, parseCookies } from "../lib/utils.js";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import type { TelegramClient } from "telegram";

const auth = new Hono<{ Variables: Variables }>();

const SESSION_COOKIE = "tdrive_session";
const CSRF_COOKIE = "tdrive_csrf";

function setSessionCookies(c: any, token: string, csrfToken: string) {
  c.header("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`);
  c.header("Set-Cookie", `${CSRF_COOKIE}=${csrfToken}; Path=/; SameSite=Lax; Max-Age=28800`, { append: true });
}

// Register
auth.post("/register", async (c) => {
  const body = z.parse(z.object({ email: z.string().email(), password: z.string().min(6) }), await c.req.json());
  
  const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Conflict", message: "Email already registered", statusCode: 409 }, 409);
  }

  // Check if registration is enabled
  const [regSetting] = await db.select().from(appSettings).where(eq(appSettings.key, "registration_enabled")).limit(1);
  const userCount = await db.select({ count: count() }).from(users);
  
  // First user always allowed (becomes operator)
  if (userCount[0].count > 0 && regSetting?.boolValue === false) {
    return c.json({ error: "Forbidden", message: "Registration is disabled", statusCode: 403 }, 403);
  }

  const id = newId();
  const isFirstUser = userCount[0].count === 0;
  const passwordHash = await hashPassword(body.password);

  await db.insert(users).values({
    id,
    email: body.email,
    passwordHash,
    isOperator: isFirstUser,
  });

  const { token, csrfToken } = await signToken(id);
  setSessionCookies(c, token, csrfToken);

  return c.json({
    data: {
      access_token: token,
      csrf_token: csrfToken,
      user: { id, email: body.email, isOperator: isFirstUser },
    },
  }, 201);
});

// Login
auth.post("/login", async (c) => {
  const body = z.parse(z.object({ email: z.string().email(), password: z.string() }), await c.req.json());

  const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (!user) {
    return c.json({ error: "Unauthorized", message: "Invalid credentials", statusCode: 401 }, 401);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Unauthorized", message: "Invalid credentials", statusCode: 401 }, 401);
  }

  const { token, csrfToken } = await signToken(user.id);
  setSessionCookies(c, token, csrfToken);

  return c.json({
    data: {
      access_token: token,
      csrf_token: csrfToken,
      user: {
        id: user.id,
        email: user.email,
        isOperator: user.isOperator,
        hasTelegramApiCredentials: !!user.telegramApiIdEncrypted,
        hasTelegramSession: !!user.telegramSessionEncrypted,
      },
    },
  });
});

// Logout
auth.post("/logout", (c) => {
  c.header("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  c.header("Set-Cookie", `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`, { append: true });
  return c.body(null, 204);
});

// Get current user
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return c.json({ error: "Not Found", message: "User not found", statusCode: 404 }, 404);
  }

  return c.json({
    data: {
      id: user.id,
      email: user.email,
      isOperator: user.isOperator,
      hasTelegramApiCredentials: !!user.telegramApiIdEncrypted,
      hasTelegramSession: !!user.telegramSessionEncrypted,
      driveInitialized: user.driveInitialized,
    },
  });
});

// Update account
auth.put("/account", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({
      current_password: z.string(),
      email: z.string().email().optional(),
      new_password: z.string().min(6).optional(),
    }),
    await c.req.json()
  );

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: "Not Found", message: "User not found", statusCode: 404 }, 404);

  const valid = await verifyPassword(body.current_password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Unauthorized", message: "Invalid current password", statusCode: 401 }, 401);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.email) updates.email = body.email;
  if (body.new_password) updates.passwordHash = await hashPassword(body.new_password);

  await db.update(users).set(updates).where(eq(users.id, userId));

  return c.json({
    data: {
      id: user.id,
      email: body.email ?? user.email,
      isOperator: user.isOperator,
    },
  });
});

// Registration settings
auth.get("/registration-settings", async (c) => {
  const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, "registration_enabled")).limit(1);
  return c.json({ data: { registrationEnabled: setting?.boolValue ?? true } });
});

auth.put("/registration-settings", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isOperator) {
    return c.json({ error: "Forbidden", message: "Operator access required", statusCode: 403 }, 403);
  }

  const body = z.parse(z.object({ registration_enabled: z.boolean() }), await c.req.json());

  const existing = await db.select().from(appSettings).where(eq(appSettings.key, "registration_enabled")).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ boolValue: body.registration_enabled }).where(eq(appSettings.key, "registration_enabled"));
  } else {
    await db.insert(appSettings).values({ key: "registration_enabled", boolValue: body.registration_enabled });
  }

  return c.json({ data: { registrationEnabled: body.registration_enabled } });
});

// Telegram credentials
auth.put("/telegram-credentials", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(z.object({ api_id: z.string(), api_hash: z.string() }), await c.req.json());

  await db.update(users).set({
    telegramApiIdEncrypted: encryptGlobal(body.api_id),
    telegramApiHashEncrypted: encryptGlobal(body.api_hash),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  return c.json({
    data: {
      id: userId,
      hasTelegramApiCredentials: true,
    },
  });
});

// Telegram session
auth.put("/telegram-session", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(z.object({ session: z.string() }), await c.req.json());

  await db.update(users).set({
    telegramSessionEncrypted: encryptGlobal(body.session),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  return c.json({
    data: {
      id: userId,
      hasTelegramSession: true,
    },
  });
});

// In-memory store for pending Telegram logins (per user)
// Preserves the MTProto client so phoneCodeHash stays valid across start→verify
const pendingLogins = new Map<string, { client: TelegramClient; phoneCodeHash: string; phone: string }>();

// Telegram login start — send code via MTProto
auth.post("/telegram-login/start", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(z.object({ phone: z.string().min(5) }), await c.req.json());

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.telegramApiIdEncrypted || !user?.telegramApiHashEncrypted) {
    return c.json({ error: "Bad Request", message: "Save API credentials first", statusCode: 400 }, 400);
  }

  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");

  const apiId = Number(decryptGlobal(user.telegramApiIdEncrypted));
  const apiHash = decryptGlobal(user.telegramApiHashEncrypted);
  const creds = { apiId, apiHash };

  // Clean up any previous pending login
  const existing = pendingLogins.get(userId);
  if (existing) {
    try { await existing.client.disconnect(); } catch {}
    pendingLogins.delete(userId);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 2,
    useWSS: true,
  });

  try {
    await client.connect();
    const { phoneCodeHash } = await client.sendCode(creds, body.phone);
    if (!phoneCodeHash) {
      await client.disconnect();
      return c.json({ error: "Internal Error", message: "Failed to get code hash", statusCode: 500 }, 500);
    }

    // Store client in memory — keeps phoneCodeHash valid
    pendingLogins.set(userId, { client, phoneCodeHash, phone: body.phone });

    // Also store phone encrypted in DB as fallback
    await db.update(users).set({
      telegramLoginPhoneEncrypted: encryptGlobal(body.phone),
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    return c.json({
      data: {
        next_step: "code",
        message: `Code sent to ${body.phone}`,
      },
    });
  } catch (err: any) {
    try { await client.disconnect(); } catch {}
    pendingLogins.delete(userId);
    return c.json({
      error: "Telegram Error",
      message: err.message || "Failed to send code",
      statusCode: 502,
    }, 502);
  }
});

// Telegram login verify — verify code, get session
auth.post("/telegram-login/verify", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(z.object({ code: z.string().min(4) }), await c.req.json());

  const pending = pendingLogins.get(userId);
  if (!pending) {
    return c.json({ error: "Bad Request", message: "No pending login. Start again.", statusCode: 400 }, 400);
  }

  const { client, phoneCodeHash, phone } = pending;

  try {
    const { Api } = await import("telegram");
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: body.code,
      })
    );

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      return c.json({ error: "Telegram Error", message: "Registration required for this phone", statusCode: 502 }, 502);
    }

    // Save session string
    const sessionString = client.session.save() as unknown as string;
    await db.update(users).set({
      telegramSessionEncrypted: encryptGlobal(sessionString),
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    // Auto-create storage channel if it doesn't exist
    let channelCreated = false;
    try {
      const { resolveChannel } = await import("../services/telegram/client.js");
      const env = getEnv();
      await resolveChannel(client, env.TDRIVE_STORAGE_CHANNEL);
      channelCreated = true;
    } catch {
      // Channel creation failed — non-fatal, will retry on first upload
    }

    await client.disconnect();
    pendingLogins.delete(userId);

    return c.json({
      data: {
        next_step: "complete",
        hasTelegramSession: true,
        channelCreated,
        message: channelCreated
          ? "Telegram connected and storage channel ready"
          : "Telegram connected successfully",
      },
    });
  } catch (err: any) {
    // Don't disconnect on error — user might retry with correct code
    // If it's a fatal error, clean up
    if (err.message?.includes("PHONE_CODE_EXPIRED") || err.message?.includes("CODE_HASH_EXPIRED")) {
      try { await client.disconnect(); } catch {}
      pendingLogins.delete(userId);
    }
    return c.json({
      error: "Telegram Error",
      message: err.message || "Verification failed",
      statusCode: 502,
    }, 502);
  }
});

export default auth;
