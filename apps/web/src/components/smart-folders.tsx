"use client";

import { useMemo } from "react";
import { HardDrive, Flame, Clock, Archive, Sparkles, Folder, Star, Image, Film, FileText, Music, Package, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DriveItem } from "@tdrive/shared";

interface SmartFoldersProps {
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
  items?: DriveItem[];
  isLoading?: boolean;
}

interface SmartFilterDef {
  id: string;
  label: string;
  icon: typeof HardDrive;
  badge?: string;
  match: (item: DriveItem) => boolean;
}

function getExt(item: DriveItem): string {
  return item.name.includes(".") ? item.name.split(".").pop()?.toLowerCase() ?? "" : "";
}

export function SmartFolders({ activeFilter = "all", onSelectFilter, items = [], isLoading }: SmartFoldersProps) {
  const filters: SmartFilterDef[] = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    return [
      { id: "all", label: "All Items", icon: HardDrive, match: () => true },
      {
        id: "large",
        label: "Large Files",
        icon: Flame,
        badge: ">500MB",
        match: (item) => item.kind === "file" && item.size > 500 * 1024 * 1024,
      },
      {
        id: "recent",
        label: "Recent",
        icon: Clock,
        badge: "7 hari",
        match: (item) => item.kind === "file" && now - new Date(item.updatedAt).getTime() < 7 * DAY,
      },
      {
        id: "archive",
        label: "Cold Archive",
        icon: Archive,
        badge: ">180d",
        match: (item) => item.kind === "file" && now - new Date(item.updatedAt).getTime() > 180 * DAY,
      },
      {
        id: "starred",
        label: "Favorites",
        icon: Star,
        match: (item) => item.isStarred === 1,
      },
      {
        id: "images",
        label: "Images",
        icon: Image,
        match: (item) => item.kind === "file" && ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(getExt(item)),
      },
      {
        id: "videos",
        label: "Videos",
        icon: Film,
        match: (item) => item.kind === "file" && ["mp4", "mkv", "avi", "mov", "webm", "flv"].includes(getExt(item)),
      },
      {
        id: "documents",
        label: "Documents",
        icon: FileText,
        match: (item) => item.kind === "file" && ["pdf", "doc", "docx", "txt", "rtf", "md", "xls", "xlsx", "ppt", "pptx", "json", "csv", "log"].includes(getExt(item)),
      },
      {
        id: "audio",
        label: "Audio",
        icon: Music,
        match: (item) => item.kind === "file" && ["mp3", "wav", "flac", "ogg", "m4a", "aac"].includes(getExt(item)),
      },
      {
        id: "archives",
        label: "Archives",
        icon: Package,
        match: (item) => item.kind === "file" && ["zip", "rar", "7z", "tar", "gz", "bz2"].includes(getExt(item)),
      },
    ];
  }, []);

  // Hitung count nyata per filter dari data item asli
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const f of filters) {
      result[f.id] = items.filter(f.match).length;
    }
    return result;
  }, [filters, items]);

  // Filter yang punya item (non-zero) ditampilkan lebih dulu; 'all' selalu pertama
  const visible = useMemo(() => {
    return [
      filters[0],
      ...filters.slice(1)
        .filter((f) => counts[f.id] > 0 || activeFilter === f.id)
        .sort((a, b) => counts[b.id] - counts[a.id]),
    ];
  }, [filters, counts, activeFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Menghitung smart folders…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {visible.map((f) => {
        const Icon = f.icon;
        const isActive = activeFilter === f.id;
        const count = counts[f.id];
        return (
          <button
            key={f.id}
            onClick={() => onSelectFilter && onSelectFilter(f.id)}
            title={`${f.label} (${count} item)`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {f.label}
            {f.badge && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400">
                {f.badge}
              </Badge>
            )}
            <span className={`text-[10px] font-semibold tabular-nums ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
              {count}
            </span>
          </button>
        );
      })}
      {!isLoading && items.length > 0 && (
        <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0 hidden sm:inline">
          <Folder className="h-3 w-3 inline mr-0.5" />
          {items.length} item · count real-time
        </span>
      )}
    </div>
  );
}
