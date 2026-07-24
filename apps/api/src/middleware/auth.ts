import { createMiddleware } from "hono/factory";
import { verifyToken } from "../lib/jwt.js";
import { parseCookies } from "../lib/utils.js";
import { db } from "../db/index.js";
import { users } from "../db/schema/users.js";
import { eq } from "drizzle-orm";

export type Variables = {
  userId: string;
  isOperator: boolean;
};

export const authMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const method = c.req.method;

  // Try ?token query param
  const queryToken = c.req.query("token");
  if (queryToken) {
    const userId = await verifyToken(queryToken);
    if (userId) {
      c.set("userId", userId);
      await next();
      return;
    }
  }

  // Try Bearer token first
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = await verifyToken(token);
    if (userId) {
      c.set("userId", userId);
      await next();
      return;
    }
  }

  // Try cookie session
  const cookies = parseCookies(c.req.header("Cookie"));
  const sessionToken = cookies["tdrive_session"];
  if (sessionToken) {
    const userId = await verifyToken(sessionToken);
    if (userId) {
      // CSRF check for non-safe methods
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        const csrfCookie = cookies["tdrive_csrf"];
        const csrfHeader = c.req.header("X-CSRF-Token");
        if (!csrfCookie || csrfCookie !== csrfHeader) {
          return c.json({ error: "Forbidden", message: "CSRF token mismatch", statusCode: 403 }, 403);
        }
      }
      c.set("userId", userId);
      await next();
      return;
    }
  }

  return c.json({ error: "Unauthorized", message: "Authentication required", statusCode: 401 }, 401);
});

export const operatorMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const userId = c.get("userId");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.isOperator) {
    return c.json({ error: "Forbidden", message: "Operator access required", statusCode: 403 }, 403);
  }
  c.set("isOperator", true);
  await next();
});
