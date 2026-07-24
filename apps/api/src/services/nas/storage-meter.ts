import { db } from "../../db/index.js";
import { driveItems } from "../../db/schema/drive-items.js";
import { eq, and, isNull, sum } from "drizzle-orm";

export interface PlanQuota {
  tier: "free" | "pro" | "business";
  maxBytes: number;
  maxUploadBytes: number;
  allowPublicSharing: boolean;
  allowWebDAV: boolean;
}

export const PLAN_LIMITS: Record<string, PlanQuota> = {
  free: {
    tier: "free",
    maxBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    maxUploadBytes: 1073741824, // 1 GB
    allowPublicSharing: true,
    allowWebDAV: true,
  },
  pro: {
    tier: "pro",
    maxBytes: 1000 * 1024 * 1024 * 1024, // 1 TB
    maxUploadBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    allowPublicSharing: true,
    allowWebDAV: true,
  },
  business: {
    tier: "business",
    maxBytes: 10 * 1024 * 1024 * 1024 * 1024, // 10 TB
    maxUploadBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    allowPublicSharing: true,
    allowWebDAV: true,
  },
};

export async function getUserStorageMetrics(userId: string, planTier: string = "free") {
  const [stats] = await db
    .select({
      totalUsedBytes: sum(driveItems.size),
    })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), isNull(driveItems.deletedAt)));

  const usedBytes = Number(stats?.totalUsedBytes ?? 0);
  const plan = PLAN_LIMITS[planTier] || PLAN_LIMITS.free;
  const remainingBytes = Math.max(0, plan.maxBytes - usedBytes);
  const usagePercentage = Math.min(100, Math.round((usedBytes / plan.maxBytes) * 100));

  return {
    planTier: plan.tier,
    maxBytes: plan.maxBytes,
    usedBytes,
    remainingBytes,
    usagePercentage,
    maxUploadBytes: plan.maxUploadBytes,
    allowPublicSharing: plan.allowPublicSharing,
    allowWebDAV: plan.allowWebDAV,
    isQuotaExceeded: usedBytes >= plan.maxBytes,
  };
}
