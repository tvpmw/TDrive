"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { Upload, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
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
}

interface UploadContextType {
  tasks: UploadTask[];
  addTask: (task: Omit<UploadTask, "progress" | "status">) => void;
  updateProgress: (id: string, progress: number) => void;
  setTaskStatus: (id: string, status: UploadTask["status"], errorMessage?: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [minimized, setMinimized] = useState(false);

  const addTask = (task: Omit<UploadTask, "progress" | "status">) => {
    setTasks((prev) => [
      ...prev,
      { ...task, progress: 0, status: "uploading" },
    ]);
  };

  const updateProgress = (id: string, progress: number) => {
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
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status === "uploading"));
  };

  const activeCount = tasks.filter((t) => t.status === "uploading").length;

  return (
    <UploadContext.Provider
      value={{ tasks, addTask, updateProgress, setTaskStatus, removeTask, clearCompleted }}
    >
      {children}

      {/* Floating Upload Widget */}
      {tasks.length > 0 && (
        <div className="fixed bottom-4 right-4 w-80 md:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden text-card-foreground transition-all">
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
                  : `Unggahan Selesai (${tasks.length})`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setMinimized(!minimized);
                }}
              >
                {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Body List */}
          {!minimized && (
            <div className="max-h-60 overflow-y-auto divide-y divide-border p-2 space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="p-2 space-y-1.5 rounded-lg hover:bg-accent/40 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[200px]" title={task.name}>
                      {task.name}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {task.status === "completed" && (
                        <span className="text-green-500 flex items-center gap-0.5 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Selesai
                        </span>
                      )}
                      {task.status === "error" && (
                        <span className="text-destructive flex items-center gap-0.5 font-medium">
                          <AlertCircle className="h-3 w-3" /> Gagal
                        </span>
                      )}
                      {task.status === "uploading" && <span>{formatBytes(task.size)}</span>}
                    </div>
                  </div>

                  {task.status === "uploading" && (
                    <Progress value={task.progress} className="h-1.5 bg-accent" />
                  )}
                </div>
              ))}
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
