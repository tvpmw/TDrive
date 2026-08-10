"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { History, RotateCcw, FileText, Loader2, CheckCircle2 } from "lucide-react";

interface Revision {
  id: string;
  revisionNumber: number;
  size: number;
  createdAt: string;
  createdBy: string;
  storageRemoteId: string | null;
  storageProvider: string | null;
}

interface RevisionsDialogProps {
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored?: () => void;
}

export function RevisionsDialog({ itemId, itemName, open, onOpenChange, onRestored }: RevisionsDialogProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["revisions", itemId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/advanced/files/${itemId}/revisions`);
      return (res.data?.revisions ?? []) as Revision[];
    },
    enabled: open && !!itemId,
  });

  useEffect(() => {
    if (!open) setNotice(null);
  }, [open]);

  const restoreMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      const res = await apiClient.post(`/api/advanced/files/${itemId}/revisions/${revisionId}/restore`);
      return res.data as { restoredRevision: number };
    },
    onSuccess: (data) => {
      setNotice({ ok: true, text: `✓ Restored ke revisi ${data.restoredRevision}` });
      queryClient.invalidateQueries({ queryKey: ["revisions", itemId] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      onRestored?.();
    },
    onError: (err: any) => {
      setNotice({ ok: false, text: err?.response?.data?.message || "Gagal restore" });
    },
  });

  const formatBytes = useCallback((b: number) => {
    if (!b) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
    return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }, []);

  const formatDate = useCallback((iso: string) => {
    try {
      return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  }, []);

  const revisions = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4.5 w-4.5 text-purple-400" />
            Riwayat Versi
          </DialogTitle>
          <DialogDescription className="text-xs break-all">{itemName}</DialogDescription>
        </DialogHeader>

        {notice && (
          <div
            className={`text-xs font-medium px-3.5 py-2.5 rounded-lg border ${
              notice.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {notice.text}
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…
            </div>
          )}
          {isError && !isLoading && (
            <div className="text-center py-8 text-xs text-red-400">Gagal memuat riwayat versi.</div>
          )}
          {!isLoading && !isError && revisions.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <FileText className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Belum ada revisi. Upload ulang file dengan nama yang sama untuk membuat versi baru.
            </div>
          )}
          {revisions.map((rev, idx) => (
            <div
              key={rev.id}
              className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Versi {rev.revisionNumber}</span>
                    {idx === 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-400">Sebelumnya</Badge>}
                    {idx === revisions.length - 1 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-600 text-slate-400">Versi Awal</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDate(rev.createdAt)} · {formatBytes(rev.size)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 font-mono">
                    {rev.storageRemoteId?.startsWith("telegram://") ? "☁️ Telegram" : rev.storageRemoteId?.startsWith("local://") ? "💾 Lokal" : rev.storageProvider || "—"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(rev.id)}
                className="shrink-0 h-8 text-xs gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
              >
                {restoreMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Restore
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          Riwayat = versi sebelumnya. Restore menyimpan state saat ini sebagai revisi baru — selalu bisa dibatalkan.
        </div>
      </DialogContent>
    </Dialog>
  );
}
