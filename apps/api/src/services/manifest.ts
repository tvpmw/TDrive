/**
 * Manifest service — encrypted snapshots of user's file metadata.
 * Used for recovery and audit trails.
 */
import { db } from "../db/index.js";
import { manifestSnapshots } from "../db/schema/manifest-snapshots.js";
import { driveItems } from "../db/schema/drive-items.js";
import { eq, and, isNull, desc } from "drizzle-orm";
import { encryptForUser, decryptForUser } from "../lib/crypto.js";
import { newId } from "../lib/utils.js";

export interface ManifestEntry {
  id: string;
  name: string;
  kind: "file" | "folder";
  parentId: string | null;
  size: number;
  mimeType: string | null;
  storageRemoteId: string | null;
  storageChannelName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create an encrypted manifest snapshot for a user.
 */
export async function createManifestSnapshot(userId: string): Promise<string> {
  // Fetch all non-deleted drive items for user
  const items = await db.select().from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt)));

  const entries: ManifestEntry[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind as "file" | "folder",
    parentId: item.parentId,
    size: item.size,
    mimeType: item.mimeType,
    storageRemoteId: item.storageRemoteId,
    storageChannelName: item.storageChannelName,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  const plaintext = JSON.stringify(entries);
  const encrypted = encryptForUser(userId, plaintext);

  const snapshotId = newId();
  await db.insert(manifestSnapshots).values({
    id: snapshotId,
    userId,
    contentEncrypted: encrypted,
  });

  return snapshotId;
}

/**
 * Get the latest manifest snapshot for a user.
 */
export async function getLatestManifest(userId: string) {
  const [snapshot] = await db.select().from(manifestSnapshots)
    .where(eq(manifestSnapshots.userId, userId))
    .orderBy(desc(manifestSnapshots.createdAt))
    .limit(1);

  if (!snapshot) return null;

  const decrypted = decryptForUser(userId, snapshot.contentEncrypted);
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    entries: JSON.parse(decrypted) as ManifestEntry[],
  };
}

/**
 * Delete old manifest snapshots, keeping only the last `keepCount`.
 */
export async function cleanupManifests(userId: string, keepCount = 10): Promise<number> {
  const all = await db.select({ id: manifestSnapshots.id, createdAt: manifestSnapshots.createdAt })
    .from(manifestSnapshots)
    .where(eq(manifestSnapshots.userId, userId))
    .orderBy(desc(manifestSnapshots.createdAt));

  if (all.length <= keepCount) return 0;

  const toDelete = all.slice(keepCount);
  for (const snap of toDelete) {
    await db.delete(manifestSnapshots).where(eq(manifestSnapshots.id, snap.id));
  }
  return toDelete.length;
}
