"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Image, Film, Music, FileText, Archive, HardDrive, Cloud, CheckCircle2, AlertCircle } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface AnalyticsData {
  totalBytes: number;
  totalFiles: number;
  categories: {
    images: { count: number; size: number };
    videos: { count: number; size: number };
    audio: { count: number; size: number };
    documents: { count: number; size: number };
    archives: { count: number; size: number };
    other: { count: number; size: number };
  };
  syncStatus: {
    synced: number;
    local: number;
    syncing: number;
    error: number;
  };
}

export function StorageAnalytics() {
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["storage-analytics"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: AnalyticsData }>("/storage/analytics");
      return res.data.data;
    },
  });

  if (!analytics || !analytics.categories) return null;

  const total = analytics.totalBytes || 1;

  const items = [
    { label: "Gambar", icon: Image, color: "bg-pink-500", ...(analytics.categories.images ?? { count: 0, size: 0 }) },
    { label: "Video", icon: Film, color: "bg-purple-500", ...(analytics.categories.videos ?? { count: 0, size: 0 }) },
    { label: "Audio", icon: Music, color: "bg-orange-500", ...(analytics.categories.audio ?? { count: 0, size: 0 }) },
    { label: "Dokumen", icon: FileText, color: "bg-blue-500", ...(analytics.categories.documents ?? { count: 0, size: 0 }) },
    { label: "Arsip", icon: Archive, color: "bg-amber-500", ...(analytics.categories.archives ?? { count: 0, size: 0 }) },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" /> Analisis Penyimpanan
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {formatBytes(analytics.totalBytes)} ({analytics.totalFiles} File)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Breakdown Progress */}
        <div className="space-y-2">
          {items.map((cat) => {
            const pct = Math.round((cat.size / total) * 100);
            const Icon = cat.icon;
            return (
              <div key={cat.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" /> {cat.label} ({cat.count})
                  </span>
                  <span className="font-medium tabular-nums">{formatBytes(cat.size)}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </div>

        {/* Sync Status Badges */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
          <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> {analytics.syncStatus.synced} Synced to Telegram
          </div>
          <div className="flex items-center gap-1.5 text-amber-500 font-medium">
            <Cloud className="h-3.5 w-3.5" /> {analytics.syncStatus.local} Local Staged
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
