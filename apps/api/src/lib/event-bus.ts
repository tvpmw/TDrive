/** In-memory pub/sub untuk activity realtime (SSE). Antar-worker tidak sync — cukup untuk single-instance. */
type Listener = (event: ActivityEvent) => void;

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
