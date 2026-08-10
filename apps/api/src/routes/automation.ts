import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../db/index.js";
import { automationRules } from "../db/schema/advanced-features.js";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { newId } from "../lib/utils.js";

const automation = new Hono<{ Variables: Variables }>();

// List semua aturan user
automation.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const rules = await db.select().from(automationRules)
    .where(eq(automationRules.userId, userId))
    .orderBy(desc(automationRules.createdAt));
  return c.json({ data: rules });
});

// Buat aturan baru
automation.post("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = z.parse(
    z.object({
      name: z.string().min(1),
      trigger_event: z.string(),
      action_type: z.string(),
      target_url: z.string().nullable().optional(),
      config: z.record(z.string(), z.any()).nullable().optional(),
    }),
    await c.req.json()
  );
  const id = newId();
  await db.insert(automationRules).values({
    id,
    userId,
    name: body.name,
    triggerEvent: body.trigger_event,
    actionType: body.action_type,
    targetUrl: body.target_url ?? null,
    config: body.config ?? null,
    isActive: 1,
  });
  const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id)).limit(1);
  return c.json({ data: rule }, 201);
});

// Update aturan (toggle aktif / rename / config)
automation.patch("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { is_active?: number; name?: string; config?: Record<string, any> };
  const updates: Record<string, any> = {};
  if (body.is_active !== undefined) updates.isActive = body.is_active;
  if (body.name !== undefined) updates.name = body.name;
  if (body.config !== undefined) updates.config = body.config;
  await db.update(automationRules).set(updates)
    .where(and(eq(automationRules.id, id), eq(automationRules.userId, userId)));
  const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id)).limit(1);
  return c.json({ data: rule });
});

// Hapus aturan
automation.delete("/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await db.delete(automationRules).where(and(eq(automationRules.id, id), eq(automationRules.userId, userId)));
  return c.body(null, 204);
});

export default automation;
