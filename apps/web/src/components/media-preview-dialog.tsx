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
import { Download, ExternalLink, Film, Music, Image as ImageIcon, FileText, Star, Calendar, Folder, File, Archive, Loader2 } from "lucide-react";
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

interface ZipEntry {
  name: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
}

interface ZipPreview {
  entries: ZipEntry[];
  fileCount: number;
  dirCount: number;
  totalUncompressed: number;
  totalCompressed: number;
}

interface MediaPreviewDialogProps {
  item: DriveItem | null;
  onClose: () => void;
}

export function MediaPreviewDialog({ item, onClose }: MediaPreviewDialogProps) {
  const [meta, setMeta] = useState<TmdbMeta | null>(null);
  const [zipData, setZipData] = useState<ZipPreview | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) { setMeta(null); setZipData(null); setZipError(null); return; }
    const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
    if (["mp4", "webm", "mkv", "mov", "avi"].includes(ext)) {
      apiClient.get<{ data: TmdbMeta }>(`/media/metadata?title=${encodeURIComponent(item.name)}`)
        .then((r) => setMeta(r.data.data))
        .catch(() => setMeta(null));
    } else {
      setMeta(null);
    }

    // ZIP preview instan
    if (ext === "zip") {
      setZipLoading(true);
      setZipError(null);
      setZipData(null);
      apiClient.get<{ data: ZipPreview }>(`/files/${item.id}/zip-preview`)
        .then((r) => setZipData(r.data.data))
        .catch((err) => setZipError(err?.message || "Gagal membaca isi ZIP"))
        .finally(() => setZipLoading(false));
    } else {
      setZipLoading(false);
      setZipError(null);
      setZipData(null);
    }
  }, [item]);

  if (!item) return null;

  const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  const isVideo = ["mp4", "webm", "mkv", "mov", "avi"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext);
  const isPdf = ext === "pdf";
  const isZip = ext === "zip";

  // Backend streaming / download URL — WAJIB same-origin (rewrite Next ke API) karena
  // elemen browser (img/video/audio/iframe/a) tidak bisa resolve hostname internal
  // seperti NEXT_PUBLIC_API_URL. Session cookie terkirim otomatis; ?token fallback.
  const token = typeof window !== "undefined" ? (localStorage.getItem("tdrive_token") || "") : "";
  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
  const streamUrl = `/api/files/${item.id}/download?inline=true${tokenQuery}`;
  const downloadUrl = `/api/files/${item.id}/download?token=${encodeURIComponent(token)}`;

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

          {isZip && (
            <div className="w-full max-h-[65vh] overflow-y-auto rounded-lg bg-card/80 border border-border p-3">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 text-xs">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Archive className="h-4 w-4 text-yellow-500" /> Isi Arsip
                </span>
                {zipData && !zipLoading && (
                  <span className="text-muted-foreground">
                    {zipData.fileCount} file • {formatBytes(zipData.totalUncompressed)}
                    {zipData.totalCompressed > 0 && zipData.totalCompressed < zipData.totalUncompressed
                      ? ` → ${formatBytes(zipData.totalCompressed)} terkompresi`
                      : ""}
                  </span>
                )}
              </div>

              {zipLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" /> Membaca isi ZIP...
                </div>
              )}

              {zipError && !zipLoading && (
                <p className="text-xs text-destructive py-4 text-center">{zipError}</p>
              )}

              {zipData && !zipLoading && (
                <ul className="space-y-0.5 text-xs">
                  {zipData.entries.slice(0, 200).map((e, i) => (
                    <li key={i} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 min-w-0">
                      {e.isDirectory
                        ? <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        : <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="truncate flex-1 font-mono text-[11px]">{e.name}</span>
                      {!e.isDirectory && <span className="shrink-0 text-muted-foreground">{formatBytes(e.size)}</span>}
                    </li>
                  ))}
                  {zipData.entries.length > 200 && (
                    <li className="px-2 py-1 text-[11px] text-muted-foreground italic">
                      +{zipData.entries.length - 200} entri lainnya...
                    </li>
                  )}
                  {zipData.entries.length === 0 && (
                    <li className="px-2 py-4 text-center text-muted-foreground">Arsip kosong</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {!isImage && !isVideo && !isAudio && !isPdf && !isZip && (
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
