import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export const sseRoutes = new Hono();

sseRoutes.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connected event
    await stream.writeSSE({
      data: JSON.stringify({ type: "connected", timestamp: new Date().toISOString() }),
      event: "system.ready",
      id: String(Date.now()),
    });

    // Stream heartbeat ping every 15s
    const interval = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }),
          event: "heartbeat",
          id: String(Date.now()),
        });
      } catch {
        clearInterval(interval);
      }
    }, 15000);

    // Keep connection open
    await new Promise((resolve) => {
      stream.onAbort(() => {
        clearInterval(interval);
        resolve(true);
      });
    });
  });
});
