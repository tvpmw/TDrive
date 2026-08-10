import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getEnv } from "./env.js";
import authRoutes from "./routes/auth.js";
import filesRoutes from "./routes/files.js";
import foldersRoutes from "./routes/folders.js";
import trashRoutes from "./routes/trash.js";
import deletionJobsRoutes from "./routes/deletion-jobs.js";
import serverFilesRoutes from "./routes/server-files.js";
import storageRoutes from "./routes/storage.js";
import systemRoutes from "./routes/system.js";
import recoveryRoutes from "./routes/recovery.js";
import { shareRoutes, publicShareRoutes } from "./routes/share.js";
import { webdav } from "./routes/webdav.js";
import { nasRoutes } from "./routes/nas.js";
import { mediaRoutes } from "./routes/media.js";
import { tunnelRoutes } from "./routes/tunnels.js";
import { advancedRouter } from "./routes/advanced.js";
import automationRoutes from "./routes/automation.js";
import notificationsRoutes from "./routes/notifications.js";
import webauthnRoutes from "./routes/webauthn.js";
import { telegramOpsRoutes } from "./routes/telegram-ops.js";
import { sseRoutes } from "./routes/sse.js";
import { botRoutes } from "./routes/bot.js";
import { startAllBots, stopAllBots } from "./services/telegram/bot-manager.js";

const env = getEnv();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

import { enterpriseOpsRoutes } from "./routes/enterprise-ops.js";
import { dashboardRoutes } from "./routes/dashboard.js";

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/files", filesRoutes);
app.route("/api/folders", foldersRoutes);
app.route("/api/trash", trashRoutes);
app.route("/api/automation", automationRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/webauthn", webauthnRoutes);
app.route("/api/deletion-jobs", deletionJobsRoutes);
app.route("/api/server-files", serverFilesRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/recovery", recoveryRoutes);
app.route("/api/share", shareRoutes);
app.route("/api/public/share", publicShareRoutes);
app.route("/api/nas", nasRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/tunnels", tunnelRoutes);
app.route("/api/advanced", advancedRouter);
app.route("/api/telegram-ops", telegramOpsRoutes);
app.route("/api/enterprise", enterpriseOpsRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/sse", sseRoutes);
app.route("/api/bot", botRoutes);
app.route("/webdav", webdav);
app.route("/", systemRoutes);

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({
    error: "Internal Server Error",
    message: err.message ?? "An unexpected error occurred",
    statusCode: 500,
  }, 500);
});

// 404
app.notFound((c) => {
  return c.json({
    error: "Not Found",
    message: `Route ${c.req.method} ${c.req.url} not found`,
    statusCode: 404,
  }, 404);
});

import { checkQueueStatus } from "./queue/index.js";

const port = env.API_PORT;
console.log(`TDrive API running on port ${port}`);
checkQueueStatus().then((s) => {
  if (s.redis.ok) console.log("Redis & BullMQ Workers connected successfully.");
  else console.warn("Redis Queue status:", s.redis.error);
}).catch(() => {});

// Start all registered Telegram bots
startAllBots().catch((err) => {
  console.error("[BotManager] Failed to start bots:", err.message);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await stopAllBots();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await stopAllBots();
  process.exit(0);
});

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255,
};
