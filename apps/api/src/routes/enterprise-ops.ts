import { Hono } from "hono";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { generateDiagnosticBundle } from "../services/diagnostic.js";
import { db } from "../db/index.js";
import { driveItems, savedSearches, fileRelations } from "../db/schema/index.js";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export const enterpriseOpsRoutes = new Hono<{ Variables: Variables }>();

// Diagnostic Bundle Generator
enterpriseOpsRoutes.get("/diagnostic", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const bundle = await generateDiagnosticBundle(userId);
  return c.json({ success: true, bundle });
});

// Batch Rename Tool
enterpriseOpsRoutes.post("/batch-rename", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { itemIds, pattern, replaceWith } = body as { itemIds: string[]; pattern: string; replaceWith: string };

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return c.json({ error: "Bad Request", message: "itemIds must be a non-empty array" }, 400);
  }

  const items = await db.query.driveItems.findMany({
    where: and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)),
  });

  const updated: Array<{ id: string; oldName: string; newName: string }> = [];

  for (const item of items) {
    const newName = item.name.replace(new RegExp(pattern, "gi"), replaceWith);
    if (newName !== item.name) {
      await db.update(driveItems).set({ name: newName, updatedAt: new Date() }).where(eq(driveItems.id, item.id));
      updated.push({ id: item.id, oldName: item.name, newName });
    }
  }

  return c.json({ success: true, updatedCount: updated.length, updated });
});

// Duplicate Finder Scanner
enterpriseOpsRoutes.get("/duplicates", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const storageFilter = c.req.query("storage") || "all";

  const items = await db.query.driveItems.findMany({
    where: and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt)),
  });

  const filteredItems = items.filter((item) => {
    if (item.kind !== "file") return false;
    if (storageFilter === "telegram") {
      return item.storageProvider.startsWith("telegram");
    }
    if (storageFilter === "server") {
      return item.storageProvider === "local" || item.storageProvider === "server-file";
    }
    return true;
  });

  const hashMap = new Map<string, typeof filteredItems>();
  const nameMap = new Map<string, typeof filteredItems>();

  for (const item of filteredItems) {
    if (item.fileHash) {
      const existing = hashMap.get(item.fileHash) || [];
      existing.push(item);
      hashMap.set(item.fileHash, existing);
    }
    const lowerName = item.name.toLowerCase();
    const existingName = nameMap.get(lowerName) || [];
    existingName.push(item);
    nameMap.set(lowerName, existingName);
  }

  const exactDuplicates = Array.from(hashMap.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([hash, list]) => ({ hash, count: list.length, items: list }));

  const nameDuplicates = Array.from(nameMap.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([name, list]) => ({ name, count: list.length, items: list }));

  return c.json({ success: true, exactDuplicates, nameDuplicates });
});

// Smart Auto-Deduplicate (Keep 1 Original File)
enterpriseOpsRoutes.post("/duplicates/smart-delete", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const { targetHash, targetName, storageFilter = "all" } = body as { targetHash?: string; targetName?: string; storageFilter?: string };

  const items = await db.query.driveItems.findMany({
    where: and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt)),
  });

  const filteredItems = items.filter((item) => {
    if (item.kind !== "file") return false;
    if (storageFilter === "telegram") return item.storageProvider.startsWith("telegram");
    if (storageFilter === "server") return item.storageProvider === "local" || item.storageProvider === "server-file";
    return true;
  });

  const groupsToClean: Array<typeof items> = [];

  if (targetHash) {
    const group = filteredItems.filter((i) => i.fileHash === targetHash);
    if (group.length > 1) groupsToClean.push(group);
  } else if (targetName) {
    const group = filteredItems.filter((i) => i.name.toLowerCase() === targetName.toLowerCase());
    if (group.length > 1) groupsToClean.push(group);
  } else {
    // Process ALL duplicate groups
    const map = new Map<string, typeof items>();
    for (const item of filteredItems) {
      const key = item.fileHash || item.name.toLowerCase();
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    }
    for (const [_, list] of map.entries()) {
      if (list.length > 1) groupsToClean.push(list);
    }
  }

  const idsToDelete: string[] = [];
  let spaceSavedBytes = 0;

  for (const group of groupsToClean) {
    // Priority: Keep oldest file (original creation date), or starred file
    const sorted = [...group].sort((a, b) => {
      if (a.isStarred !== b.isStarred) return b.isStarred - a.isStarred;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const keptOriginal = sorted[0];
    const duplicatesToRemove = sorted.slice(1);

    for (const dup of duplicatesToRemove) {
      idsToDelete.push(dup.id);
      spaceSavedBytes += dup.size || 0;
    }
  }

  if (idsToDelete.length > 0) {
    await db
      .update(driveItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(driveItems.id, idsToDelete));
  }

  return c.json({
    success: true,
    deletedCount: idsToDelete.length,
    spaceSavedBytes,
    keptGroupsCount: groupsToClean.length,
    message: `Smart delete completed! Kept ${groupsToClean.length} original files and removed ${idsToDelete.length} redundant duplicate copies. Saved ${spaceSavedBytes} bytes.`,
  });
});

// Saved Searches List & Create
enterpriseOpsRoutes.get("/saved-searches", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const searches = await db.query.savedSearches.findMany({
    where: eq(savedSearches.userId, userId),
  });
  return c.json({ success: true, searches });
});

enterpriseOpsRoutes.post("/saved-searches", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { name, query } = body;

  const id = `srch_${nanoid(12)}`;
  await db.insert(savedSearches).values({
    id,
    userId,
    name: name || "Saved Search",
    query: query || "",
  });

  return c.json({ success: true, id });
});

// Storage Doctor Diagnostics & Auto Repair
enterpriseOpsRoutes.get("/doctor/diagnose", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { analyzeStorageHealth } = await import("../services/telegram/storage-doctor.js");
  const report = await analyzeStorageHealth(userId);
  return c.json({ success: true, report });
});

enterpriseOpsRoutes.post("/doctor/optimize", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { executeStorageOptimization } = await import("../services/telegram/storage-doctor.js");
  const result = await executeStorageOptimization(userId);
  return c.json({ success: true, result });
});

// Storage Policy Engine Evaluator
enterpriseOpsRoutes.post("/policy/eval", authMiddleware, async (c) => {
  const body = await c.req.json();
  const { policyEngine } = await import("../services/telegram/policy-engine.js");
  const actions = policyEngine.evaluateRules(body);
  return c.json({ success: true, actions });
});

