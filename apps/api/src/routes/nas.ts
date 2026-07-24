import { Hono } from "hono";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { getUserStorageMetrics } from "../services/nas/storage-meter.js";
import os from "node:os";

export const nasRoutes = new Hono<{ Variables: Variables }>();

// SaaS User Quota Metrics
nasRoutes.get("/metrics", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const metrics = await getUserStorageMetrics(userId, "free");
  return c.json({ data: metrics });
});

// NAS System Hardware Health Monitor
nasRoutes.get("/system-health", authMiddleware, async (c) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return c.json({
    data: {
      platform: os.platform(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || "Generic CPU",
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usedPercentage: Math.round((usedMem / totalMem) * 100),
      },
      nasMode: "standalone",
      tunnelsActive: true,
    },
  });
});
