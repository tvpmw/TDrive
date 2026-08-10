"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FolderPlus, Share2, Trash2, Cloud, Bell, X } from "lucide-react";

interface ActivityEvent {
  type: "file.uploaded" | "file.deleted" | "folder.created" | "share.created" | "share.revoked" | "sync.completed" | "connected" | "ping";
  message: string;
  timestamp?: string;
}

interface Toast extends ActivityEvent {
  id: number;
}

const ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  "file.uploaded": { icon: <Upload className="h-3.5 w-3.5" />, color: "text-emerald-400" },
  "file.deleted": { icon: <Trash2 className="h-3.5 w-3.5" />, color: "text-red-400" },
  "folder.created": { icon: <FolderPlus className="h-3.5 w-3.5" />, color: "text-blue-400" },
  "share.created": { icon: <Share2 className="h-3.5 w-3.5" />, color: "text-purple-400" },
  "share.revoked": { icon: <Share2 className="h-3.5 w-3.5" />, color: "text-amber-400" },
  "sync.completed": { icon: <Cloud className="h-3.5 w-3.5" />, color: "text-cyan-400" },
};

/**
 * Realtime activity toasts — subscribe ke /sse/events dan tampilkan notifikasi
 * singkat saat ada aktivitas (upload, folder baru, share, dll).
 * Auto-dismiss 5 detik, dismiss manual dengan tombol X.
 */
export function RealtimeActivity() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [enabled, setEnabled] = useState(false);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Hanya aktif saat sudah login. Session cookie HttpOnly tak terlihat JS,
  // jadi pakai cookie CSRF (non-HttpOnly) sebagai penanda login.
  useEffect(() => {
    const check = () => setEnabled(document.cookie.includes("tdrive_csrf="));
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/sse/events");

    const onEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ActivityEvent;
        if (data.type === "ping" || data.type === "connected") return;
        const id = ++idRef.current;
        setToasts((prev) => [...prev.slice(-3), { ...data, id }]);
        const timer = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          timersRef.current.delete(id);
        }, 5000);
        timersRef.current.set(id, timer);
      } catch {
        // event non-JSON (heartbeat/comment) — abaikan
      }
    };

    es.addEventListener("activity", onEvent);
    es.addEventListener("system.ready", onEvent);

    return () => {
      es.close();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [enabled]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-72 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((toast) => {
        const meta = ICONS[toast.type] ?? { icon: <Bell className="h-3.5 w-3.5" />, color: "text-muted-foreground" };
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/95 backdrop-blur-md shadow-xl px-3 py-2.5 animate-in slide-in-from-top-2 fade-in-0 duration-200"
          >
            <span className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</span>
            <p className="flex-1 min-w-0 text-xs text-card-foreground leading-relaxed">{toast.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
