"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, FolderHeart, Loader2, X, CheckCircle2 } from "lucide-react";
import type { DriveItem } from "@tdrive/shared";

interface TagEditorDialogProps {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function TagEditorDialog({ item, open, onOpenChange, onSaved }: TagEditorDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [collInput, setCollInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (item) {
      setTags((item.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean));
      setCollections((item.collections ?? "").split(",").map((s) => s.trim()).filter(Boolean));
      setTagInput("");
      setCollInput("");
      setSaved(false);
    }
  }, [item, open]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };
  const addCollection = () => {
    const c = collInput.trim();
    if (c && !collections.includes(c)) setCollections([...collections, c]);
    setCollInput("");
  };

  const handleSave = async () => {
    if (!item) return;
    setLoading(true);
    try {
      await apiClient.patch(`/files/${item.id}`, {
        tags: tags.join(","),
        collections: collections.join(","),
      });
      setSaved(true);
      setTimeout(() => {
        onSaved?.();
        onOpenChange(false);
      }, 600);
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4.5 w-4.5 text-indigo-400" />
            Kelola Tag & Koleksi
          </DialogTitle>
          <DialogDescription className="text-xs break-all">{item.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-indigo-400" /> Tags
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                  #{t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-400 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-[11px] text-muted-foreground/60 self-center">Belum ada tag</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                placeholder="Tambah tag (Enter)…"
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addTag}>Tambah</Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <FolderHeart className="h-3.5 w-3.5 text-pink-400" /> Koleksi
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {collections.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-md bg-pink-500/15 border border-pink-500/30 px-2 py-0.5 text-[11px] font-medium text-pink-300">
                  📁 {c}
                  <button onClick={() => setCollections(collections.filter((x) => x !== c))} className="hover:text-red-400 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {collections.length === 0 && <span className="text-[11px] text-muted-foreground/60 self-center">Belum ada koleksi</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={collInput}
                onChange={(e) => setCollInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCollection(); }}
                placeholder="Tambah koleksi (Enter)…"
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addCollection}>Tambah</Button>
            </div>
          </div>

          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan!
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs h-8">Batal</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
