import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { subscribeActivity } from "../lib/event-bus.js";
import { authMiddleware, type Variables } from "../middleware/auth.js";

export const sseRoutes = new Hono<{ Variables: Variables }>();

sseRoutes.get("/events", authMiddleware, (c) => {
  const userId = c.get("userId");
  return streamSSE(c, async (stream) => {
    // Stream heartbeat ping every 15s
    let interval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe = () => {};
    let settled = false;
    const done = new Promise<void>((resolve) => {
      stream.onAbort(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        if (interval) clearInterval(interval);
        resolve();
      });
    });

    interval = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }),
          event: "heartbeat",
          id: String(Date.now()),
        });
      } catch {
        if (interval) clearInterval(interval);
      }
    }, 15000);

    // Forward activity events for this user
    unsubscribe = subscribeActivity((event) => {
      if (event.userId !== userId) return;
      stream
        .writeSSE({
          data: JSON.stringify(event),
          event: "activity",
          id: String(Date.now()),
        })
        .catch(() => {});
    });

    // Send initial connected event
    try {
      await stream.writeSSE({
        data: JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }),
        event: "system.ready",
        id: String(Date.now()),
      });
    } catch {
      // Koneksi gagal/abort saat event awal — pastikan cleanup tetap jalan
      if (!settled) {
        settled = true;
        unsubscribe();
        if (interval) clearInterval(interval);
      }
    }

    // Keep connection open
    await done;
  });
});
