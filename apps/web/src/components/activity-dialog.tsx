"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Activity, Loader2, Upload, Trash2, RotateCcw, Download, History, Share2, Tag, FileText, FolderPlus } from "lucide-react";

interface ActivityLog {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
}

interface ActivityDialogProps {
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVENT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  "file.uploaded": { icon: <Upload className="h-3.5 w-3.5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  "file.versioned": { icon: <History className="h-3.5 w-3.5" />, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  "file.restored": { icon: <RotateCcw className="h-3.5 w-3.5" />, color: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  "file.deleted": { icon: <Trash2 className="h-3.5 w-3.5" />, color: "text-red-400 bg-red-500/10 border-red-500/30" },
  "share.created": { icon: <Share2 className="h-3.5 w-3.5" />, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
  "share.downloaded": { icon: <Download className="h-3.5 w-3.5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  "file.renamed": { icon: <FileText className="h-3.5 w-3.5" />, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  "file.tagged": { icon: <Tag className="h-3.5 w-3.5" />, color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
  "folder.created": { icon: <FolderPlus className="h-3.5 w-3.5" />, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
};

export function ActivityDialog({ itemId, itemName, open, onOpenChange }: ActivityDialogProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", itemId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/advanced/files/${itemId}/activity`);
      return (res.data?.data ?? []) as ActivityLog[];
    },
    enabled: open && !!itemId,
  });

  const logs = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4.5 w-4.5 text-sky-400" />
            Aktivitas File
          </DialogTitle>
          <DialogDescription className="text-xs break-all">{itemName}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat aktivitas…
            </div>
          )}
          {isError && !isLoading && (
            <div className="text-center py-8 text-xs text-red-400">Gagal memuat aktivitas.</div>
          )}
          {!isLoading && !isError && logs.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <Activity className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Belum ada aktivitas tercatat untuk file ini.
            </div>
          )}
          {logs.map((log) => {
            const meta = EVENT_META[log.eventType] ?? { icon: <Activity className="h-3.5 w-3.5" />, color: "text-muted-foreground bg-muted/40 border-border/50" };
            return (
              <div key={log.id} className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl border border-border/50 bg-card/40">
                <div className={`p-1.5 rounded-lg border shrink-0 ${meta.color}`}>{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">{log.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(log.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}