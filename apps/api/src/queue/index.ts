import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

let syncQueue: Queue | null = null;
let deletionQueue: Queue | null = null;
let syncWorker: Worker | null = null;
let deletionWorker: Worker | null = null;
let redisClient: Redis | null = null;

const getRedisUrl = () => process.env.REDIS_URL ?? "redis://localhost:6379";

export interface SyncJobData {
  userId: string;
  driveItemId: string;
  action: "upload" | "download";
}

export interface DeletionJobData {
  userId: string;
  deletionJobId: string;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(getRedisUrl(), { maxRetriesPerRequest: null, lazyConnect: true });
  }
  return redisClient;
}

export function getSyncQueue(): Queue | null {
  if (syncQueue) return syncQueue;
  try {
    const connection = { url: getRedisUrl() };
    syncQueue = new Queue("tdrive-sync", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });

    if (!syncWorker) {
      syncWorker = new Worker("tdrive-sync", async (job) => {
        console.log(`[Worker] Processing sync job ${job.id}:`, job.data);
      }, { connection });
    }

    return syncQueue;
  } catch (err) {
    console.warn("Redis not available — sync queue disabled", err);
    return null;
  }
}

export function getDeletionQueue(): Queue | null {
  if (deletionQueue) return deletionQueue;
  try {
    const connection = { url: getRedisUrl() };
    deletionQueue = new Queue("tdrive-deletion", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });

    if (!deletionWorker) {
      deletionWorker = new Worker("tdrive-deletion", async (job) => {
        console.log(`[Worker] Processing deletion job ${job.id}:`, job.data);
      }, { connection });
    }

    return deletionQueue;
  } catch (err) {
    console.warn("Redis not available — deletion queue disabled", err);
    return null;
  }
}

export async function enqueueSync(data: SyncJobData): Promise<string | null> {
  const queue = getSyncQueue();
  if (!queue) return null;
  const job = await queue.add(`sync:${data.action}`, data);
  return job.id ?? null;
}

export async function enqueueDeletion(data: DeletionJobData): Promise<string | null> {
  const queue = getDeletionQueue();
  if (!queue) return null;
  const job = await queue.add("delete", data);
  return job.id ?? null;
}

export async function checkQueueStatus() {
  const client = getRedisClient();
  try {
    if (client.status === "wait") {
      await client.connect();
    }
    const pong = await client.ping();
    getSyncQueue();
    getDeletionQueue();
    return {
      redis: { ok: pong === "PONG", url: getRedisUrl() },
      workers: { ok: true, activeWorkers: 2 },
    };
  } catch (err: any) {
    return {
      redis: { ok: false, error: err.message || "Failed to connect to Redis" },
      workers: { ok: false, error: "Redis unavailable" },
    };
  }
}

export async function closeQueues(): Promise<void> {
  if (syncQueue) { await syncQueue.close(); syncQueue = null; }
  if (deletionQueue) { await deletionQueue.close(); deletionQueue = null; }
  if (syncWorker) { await syncWorker.close(); syncWorker = null; }
  if (deletionWorker) { await deletionWorker.close(); deletionWorker = null; }
  if (redisClient) { await redisClient.quit(); redisClient = null; }
}
