import { Hono } from "hono";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { createManifestSnapshot, getLatestManifest, cleanupManifests } from "../services/manifest.js";

const recovery = new Hono<{ Variables: Variables }>();

recovery.use("*", authMiddleware);

// Create manifest snapshot
recovery.post("/manifests", async (c) => {
  const userId = c.get("userId");
  const snapshotId = await createManifestSnapshot(userId);
  return c.json({ data: { id: snapshotId } }, 201);
});

// Get latest manifest
recovery.get("/manifests", async (c) => {
  const userId = c.get("userId");
  const manifest = await getLatestManifest(userId);
  if (!manifest) {
    return c.json({ data: null });
  }
  return c.json({ data: manifest });
});

// Restore from manifest (stub — needs UI to select entries)
recovery.post("/manifests/restore", async (c) => {
  return c.json({ error: "Not Implemented", message: "Restore flow pending", statusCode: 501 }, 501);
});

// Cleanup old manifests
recovery.post("/manifests/cleanup", async (c) => {
  const userId = c.get("userId");
  const deleted = await cleanupManifests(userId);
  return c.json({ data: { deleted } });
});

// Channel cleanup (stub)
recovery.post("/channel-cleanup", async (c) => {
  return c.json({ error: "Not Implemented", message: "Channel cleanup pending", statusCode: 501 }, 501);
});

// Telegram import (stub)
recovery.post("/telegram-import", async (c) => {
  return c.json({ error: "Not Implemented", message: "Telegram import pending", statusCode: 501 }, 501);
});

export default recovery;
