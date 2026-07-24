import { Hono } from "hono";
import { db } from "../db/index.js";
import { deletionJobs } from "../db/schema/deletion-jobs.js";
import { eq } from "drizzle-orm";
import { authMiddleware, type Variables } from "../middleware/auth.js";

const deletionJobsRoutes = new Hono<{ Variables: Variables }>();

deletionJobsRoutes.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const jobs = await db.select().from(deletionJobs).where(eq(deletionJobs.userId, userId));
  return c.json({ data: jobs });
});

deletionJobsRoutes.post("/retry", authMiddleware, async (c) => {
  return c.json({ error: "Not Implemented", message: "Retry pending BullMQ integration (Phase 6)", statusCode: 501 }, 501);
});

export default deletionJobsRoutes;
