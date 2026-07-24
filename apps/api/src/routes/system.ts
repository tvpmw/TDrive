import { Hono } from "hono";
import { checkQueueStatus } from "../queue/index.js";

const system = new Hono();

const startTime = Date.now();

system.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.1.0",
    app: "tdrive",
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

system.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.1.0",
    app: "tdrive",
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

system.get("/api/dev/stack-status", async (c) => {
  const status = await checkQueueStatus();
  return c.json({
    data: status,
  });
});

system.get("/api/update/status", (c) => {
  return c.json({
    data: {
      currentVersion: "0.1.0",
      latestVersion: null,
      updateAvailable: false,
    },
  });
});

export default system;
