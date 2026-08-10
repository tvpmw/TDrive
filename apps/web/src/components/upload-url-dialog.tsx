"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, CheckCircle2, AlertCircle, Globe } from "lucide-react";
import type { DriveItem } from "@tdrive/shared";

interface UploadUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string;
  onUploaded?: (item: DriveItem) => void;
}

export function UploadUrlDialog({ open, onOpenChange, parentId, onUploaded }: UploadUrlDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DriveItem | null>(null);

  const handleUpload = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const res = await apiClient.post<{ data: DriveItem }>("/files/upload-url", {
        url: url.trim(),
        parent_id: parentId ?? null,
      });
      setDone(res.data.data);
      setTimeout(() => {
        onUploaded?.(res.data.data);
        onOpenChange(false);
        setUrl("");
        setDone(null);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Gagal mengunduh URL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4.5 w-4.5 text-sky-400" />
            Upload dari URL
          </DialogTitle>
          <DialogDescription className="text-xs">
            Server akan mengunduh file dari link dan menyimpannya di folder ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" /> URL File
            </Label>
            <Input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); setDone(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleUpload(); }}
              placeholder="https://example.com/file.pdf"
              className="text-xs font-mono"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {done.name} berhasil diunduh!
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs h-8">Batal</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleUpload} disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
              {loading ? "Mengunduh…" : "Unduh & Simpan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}