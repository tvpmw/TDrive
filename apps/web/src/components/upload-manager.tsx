"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { Upload, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export interface UploadTask {
  id: string;
  name: string;
  size: number;
  progress: number; // 0 to 100
  status: "uploading" | "completed" | "error";
  errorMessage?: string;
  /** File asli — disimpan agar bisa di-retry tanpa input ulang */
  file?: File;
  /** Callback retry yang meng-upload ulang file ke task yang sama */
  retry?: () => void;
}

interface UploadContextType {
  tasks: UploadTask[];
  addTask: (task: Omit<UploadTask, "progress" | "status">) => void;
  updateProgress: (id: string, progress: number, loadedBytes?: number) => void;
  setTaskStatus: (id: string, status: UploadTask["status"], errorMessage?: string) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  clearCompleted: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}j`;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});
  const [loadedBytes, setLoadedBytes] = useState<Record<string, number>>({});

  const addTask = (task: Omit<UploadTask, "progress" | "status">) => {
    setTasks((prev) => {
      const next: UploadTask[] = [...prev, { ...task, progress: 0, status: "uploading" }];
      if (next.length > 50) {
        const pruned = next.slice(next.length - 50);
        // Bersihkan maps agar tidak tumbuh tak terbatas
        const evicted = new Set(next.map((t) => t.id).filter((id) => !pruned.some((t) => t.id === id)));
        setStartedAt((s) => { const n = { ...s }; evicted.forEach((id) => delete n[id]); return n; });
        setLoadedBytes((b) => { const n = { ...b }; evicted.forEach((id) => delete n[id]); return n; });
        return pruned;
      }
      return next;
    });
    setStartedAt((prev) => ({ ...prev, [task.id]: Date.now() }));
    setLoadedBytes((prev) => ({ ...prev, [task.id]: 0 }));
  };

  const updateProgress = (id: string, progress: number, loaded = 0) => {
    setLoadedBytes((prev) => ({ ...prev, [id]: loaded }));
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, progress } : t))
    );
  };

  const setTaskStatus = (id: string, status: UploadTask["status"], errorMessage?: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status, errorMessage } : t))
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setStartedAt((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setLoadedBytes((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const retryTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task?.retry) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "uploading", progress: 0, errorMessage: undefined } : t)));
    setStartedAt((prev) => ({ ...prev, [id]: Date.now() }));
    setLoadedBytes((prev) => ({ ...prev, [id]: 0 }));
    task.retry();
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status === "uploading"));
  };

  const activeCount = tasks.filter((t) => t.status === "uploading").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "error").length;

  const computeSpeedEta = (task: UploadTask): { speed: number; etaSec: number } => {
    if (task.status !== "uploading") return { speed: 0, etaSec: 0 };
    const start = startedAt[task.id];
    const loaded = loadedBytes[task.id] ?? 0;
    if (!start) return { speed: 0, etaSec: 0 };
    const elapsedSec = (Date.now() - start) / 1000;
    if (elapsedSec <= 0 || loaded <= 0) return { speed: 0, etaSec: 0 };
    const speed = loaded / elapsedSec;
    const etaSec = (task.size - loaded) / speed;
    return { speed, etaSec };
  };

  return (
    <UploadContext.Provider
      value={{ tasks, addTask, updateProgress, setTaskStatus, removeTask, retryTask, clearCompleted }}
    >
      {children}

      {/* Floating Upload Widget
          Mobile: full-width bar above the nav FAB (bottom-20) so it never blocks navigation.
          md+: right-anchored floating card. */}
      {tasks.length > 0 && (
        <div className="fixed left-4 right-4 bottom-20 md:left-auto md:right-4 md:bottom-4 w-auto md:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden text-card-foreground transition-all">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 bg-muted/60 border-b border-border cursor-pointer select-none"
            onClick={() => setMinimized(!minimized)}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold">
                {activeCount > 0
                  ? `Mengunggah ${activeCount} file...`
                  : failedCount > 0
                    ? `${failedCount} file gagal`
                    : `Unggahan Selesai (${completedCount})`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {activeCount === 0 && completedCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Bersihkan yang selesai"
                  aria-label="Bersihkan unggahan selesai"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearCompleted();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setMinimized(!minimized);
                }}
                aria-label={minimized ? "Perluas panel unggahan" : "Ciutkan panel unggahan"}
              >
                {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Body List — batas tinggi proporsional di layar kecil (35vh) agar tray tidak menutupi layar */}
          {!minimized && (
            <div className="max-h-[35vh] sm:max-h-60 overflow-y-auto divide-y divide-border p-2 space-y-2">
              {tasks.map((task) => {
                const { speed, etaSec } = computeSpeedEta(task);
                return (
                  <div key={task.id} className="p-2 space-y-1.5 rounded-lg hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium truncate min-w-0 flex-1" title={task.name}>
                        {task.name}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                        {task.status === "completed" && (
                          <span className="text-green-500 flex items-center gap-0.5 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Selesai
                          </span>
                        )}
                        {task.status === "error" && (
                          <span className="text-destructive flex items-center gap-0.5 font-medium" title={task.errorMessage ?? ""}>
                            <AlertCircle className="h-3 w-3" /> Gagal
                          </span>
                        )}
                        {task.status === "uploading" && (
                          <span className="tabular-nums">
                            {formatBytes(task.size)}
                            {speed > 0 && <span className="text-muted-foreground/70"> · {formatSpeed(speed)} · ETA {formatEta(etaSec)}</span>}
                          </span>
                        )}
                      </div>
                      {task.status === "error" && task.retry && (
                        <button
                          onClick={() => retryTask(task.id)}
                          className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-500/10 transition-colors"
                          aria-label={`Ulang unggah ${task.name}`}
                          title="Coba lagi"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => removeTask(task.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                        aria-label={`Hapus ${task.name} dari daftar unggahan`}
                        title="Hapus dari daftar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {task.status === "uploading" && (
                      <Progress value={task.progress} className="h-1.5 bg-accent" />
                    )}
                    {task.status === "error" && task.errorMessage && (
                      <p className="text-[10px] text-destructive/90 truncate" title={task.errorMessage}>
                        {task.errorMessage}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </UploadContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("useUploadManager must be used within UploadProvider");
  }
  return ctx;
}
