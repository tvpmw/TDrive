"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Share2, Copy, Check, ExternalLink, Trash2, File, Folder, Link2,
  Lock, Calendar, RefreshCw, Eye,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import type { DriveItem } from "@tdrive/shared";

export default function SharesPage() {
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["shares"],
    queryFn: () => apiClient.get<{ data: DriveItem[] }>("/share").then((r) => r.data.data),
    refetchInterval: 10_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/share/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shares"] }),
  });

  const copy = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (item: DriveItem) => item.shareExpiresAt ? new Date() > new Date(item.shareExpiresAt) : false;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <main className="p-6 space-y-6 max-w-7xl w-full mx-auto pb-fab">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" /> Share Links
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Kelola semua link berbagi publik — salin, buka, atau cabut akses.
              </p>
            </div>
            <Badge variant="outline" className="w-fit text-xs">
              {shares.length} link aktif
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : shares.length === 0 ? (
            <Card className="p-10 flex flex-col items-center justify-center text-center gap-3 border-dashed">
              <div className="rounded-full bg-muted/70 p-4">
                <Link2 className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium">Belum ada share link</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Buka Drive, klik ⋯ pada file, lalu pilih <b>Bagikan Link</b> untuk membuat link publik pertama Anda.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {shares.map((item) => {
                const expired = isExpired(item);
                const publicUrl = `${window.location.origin}/s/${item.shareToken}`;
                return (
                  <Card key={item.id} className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {item.kind === "folder"
                          ? <Folder className="h-5 w-5 text-blue-500 shrink-0" />
                          : <File className="h-5 w-5 text-primary shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[11px] text-muted-foreground">
                              {item.kind === "file" ? formatBytes(item.size) : "Folder"}
                            </span>
                            <Badge variant={expired ? "destructive" : "outline"} className="text-[9px] px-1.5 py-0 gap-0.5">
                              {expired ? <><Calendar className="h-2.5 w-2.5" /> Kedaluwarsa</> : item.shareExpiresAt ? <>Berakhir {new Date(item.shareExpiresAt).toLocaleDateString("id-ID")}</> : "Selamanya"}
                            </Badge>
                            {item.hasSharePassword && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-amber-500/40 text-amber-500">
                                <Lock className="h-2.5 w-2.5" /> Password
                              </Badge>
                            )}
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Eye className="h-3 w-3" /> {item.downloadCount ?? 0} unduhan
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 lg:shrink-0 flex-wrap">
                        <code className="hidden xl:block text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded truncate max-w-[260px]">
                          {publicUrl}
                        </code>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => copy(item.shareToken!, item.id)}>
                          {copiedId === item.id ? <Check className="h-3.5 w-3.5 mr-1 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {copiedId === item.id ? "Tersalin" : "Salin"}
                        </Button>
                        <a href={`/s/${item.shareToken}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Buka
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                          onClick={() => { if (confirm(`Cabut link berbagi ${item.name}?`)) revokeMutation.mutate(item.id); }}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Cabut
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
