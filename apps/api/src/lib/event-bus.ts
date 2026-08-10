import { db } from "../db/index.js";
import { fileActivityLog } from "../db/schema/advanced-features.js";
import { nanoid } from "nanoid";

/** In-memory pub/sub untuk activity realtime (SSE). Antar-worker tidak sync — cukup untuk single-instance. */
type Listener = (event: ActivityEvent) => void;

// Persist aktivitas per file ke DB (fire-and-forget — tidak memblokir emitter)
export function logFileActivity(userId: string, itemId: string, eventType: string, message: string, meta?: Record<string, unknown>): void {
  try {
    void db.insert(fileActivityLog).values({
      id: nanoid(16),
      userId,
      itemId,
      eventType,
      message,
      meta: meta ?? null,
    }).catch(() => {
      // log gagal — jangan crash request utama
    });
  } catch {
    // abaikan
  }
}

export interface ActivityEvent {
  type: "file.uploaded" | "file.deleted" | "folder.created" | "share.created" | "share.revoked" | "sync.completed";
  message: string;
  itemName?: string;
  userId: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const listeners = new Set<Listener>();

export function subscribeActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitActivity(event: Omit<ActivityEvent, "timestamp">): void {
  const full: ActivityEvent = { ...event, timestamp: new Date().toISOString() };
  for (const l of listeners) {
    try {
      l(full);
    } catch {
      // abaikan listener yang error
    }
  }
}
