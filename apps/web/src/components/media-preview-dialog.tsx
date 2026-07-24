"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Film, Music, Image as ImageIcon, FileText, Star, Calendar } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import type { DriveItem } from "@tdrive/shared";

interface TmdbMeta {
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
}

interface MediaPreviewDialogProps {
  item: DriveItem | null;
  onClose: () => void;
}

export function MediaPreviewDialog({ item, onClose }: MediaPreviewDialogProps) {
  const [meta, setMeta] = useState<TmdbMeta | null>(null);

  useEffect(() => {
    if (!item) { setMeta(null); return; }
    const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
    if (["mp4", "webm", "mkv", "mov", "avi"].includes(ext)) {
      apiClient.get<{ data: TmdbMeta }>(`/media/metadata?title=${encodeURIComponent(item.name)}`)
        .then((r) => setMeta(r.data.data))
        .catch(() => setMeta(null));
    } else {
      setMeta(null);
    }
  }, [item]);

  if (!item) return null;

  const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  const isVideo = ["mp4", "webm", "mkv", "mov", "avi"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext);
  const isPdf = ext === "pdf";

  // Backend streaming / download URL with inline flag
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const token = typeof window !== "undefined" ? (localStorage.getItem("tdrive_token") || "") : "";
  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
  const streamUrl = `${apiBase}/api/files/${item.id}/download?inline=true${tokenQuery}`;
  const downloadUrl = `${apiBase}/api/files/${item.id}/download?token=${encodeURIComponent(token)}`;

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 gap-3 bg-card border-border overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border space-y-0">
          <div className="flex items-center gap-2 min-w-0 pr-4">
            {isImage && <ImageIcon className="h-5 w-5 text-pink-400 shrink-0" />}
            {isVideo && <Film className="h-5 w-5 text-purple-400 shrink-0" />}
            {isAudio && <Music className="h-5 w-5 text-orange-400 shrink-0" />}
            {isPdf && <FileText className="h-5 w-5 text-red-400 shrink-0" />}
            {!isImage && !isVideo && !isAudio && !isPdf && <FileText className="h-5 w-5 text-primary shrink-0" />}
            
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{item.name}</DialogTitle>
              <p className="text-[11px] text-muted-foreground">{formatBytes(item.size)} • {item.mimeType || "Unknown type"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a href={downloadUrl} download={item.name}>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Unduh
              </Button>
            </a>
          </div>
        </DialogHeader>

        {/* Media Content Body */}
        <div className="flex-1 flex flex-col items-center justify-center bg-black/40 rounded-lg overflow-hidden relative p-3">
          {isImage && (
            <img
              src={streamUrl}
              alt={item.name}
              className="max-h-[65vh] max-w-full object-contain rounded"
            />
          )}

          {isVideo && (
            <div className="w-full flex flex-col gap-3">
              <video
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-h-[55vh] w-full rounded shadow-lg bg-black"
                src={streamUrl}
              >
                Browser Anda tidak mendukung elemen video.
              </video>

              {meta && (
                <div className="flex gap-4 p-3 bg-card/90 rounded-lg border border-border/60 text-xs">
                  {meta.posterUrl && (
                    <img src={meta.posterUrl} alt={meta.title} className="w-20 h-28 object-cover rounded shadow shrink-0" />
                  )}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{meta.title}</span>
                      {meta.rating && (
                        <span className="flex items-center gap-1 text-amber-400 font-semibold text-xs">
                          <Star className="h-3.5 w-3.5 fill-current" /> {meta.rating.toFixed(1)}
                        </span>
                      )}
                      {meta.releaseDate && (
                        <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                          <Calendar className="h-3 w-3" /> {meta.releaseDate.split("-")[0]}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-3 text-[11px] leading-relaxed">{meta.overview}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isAudio && (
            <div className="w-full max-w-md p-6 bg-card/90 backdrop-blur rounded-xl border border-border flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center animate-pulse">
                <Music className="h-8 w-8" />
              </div>
              <div className="w-full">
                <p className="font-semibold text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatBytes(item.size)}</p>
              </div>
              <audio controls autoPlay className="w-full mt-2" src={streamUrl}>
                Browser Anda tidak mendukung audio.
              </audio>
            </div>
          )}

          {isPdf && (
            <iframe
              src={streamUrl}
              className="w-full h-[65vh] rounded border-0"
              title={item.name}
            />
          )}

          {!isImage && !isVideo && !isAudio && !isPdf && (
            <div className="text-center p-8 space-y-3">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Pratinjau tidak tersedia untuk format file ini</p>
              <a href={downloadUrl} download={item.name}>
                <Button size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" /> Unduh untuk melihat
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
