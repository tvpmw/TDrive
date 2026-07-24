"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, RotateCcw, File, Folder, XCircle, Search, Image, Film, Music, Archive, Code, FileText, RefreshCw, Clock, HardDrive, AlertTriangle, ArrowUpRight, ArrowDownRight, LayoutGrid, List } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useState } from "react";
import type { DriveItem } from "@tdrive/shared";

function getFileIcon(item: DriveItem) {
  if (item.kind === "folder") return <Folder className="h-5 w-5 text-blue-500" />;
  const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <Image className="h-5 w-5 text-pink-400" />;
  if (["mp4", "avi", "mkv", "mov"].includes(ext)) return <Film className="h-5 w-5 text-purple-400" />;
  if (["mp3", "wav", "flac", "ogg"].includes(ext)) return <Music className="h-5 w-5 text-orange-400" />;
  if (["zip", "rar", "7z", "tar"].includes(ext)) return <Archive className="h-5 w-5 text-yellow-500" />;
  if (["js", "ts", "py", "go", "rs", "java", "c", "cpp", "css", "html"].includes(ext)) return <Code className="h-5 w-5 text-green-400" />;
  if (["md", "txt", "doc", "pdf"].includes(ext)) return <FileText className="h-5 w-5 text-cyan-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export default function TrashPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "size" | "deletedAt">("deletedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const toggleSort = (field: "name" | "size" | "deletedAt") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.trash(),
    queryFn: () => apiClient.get("/trash").then((r) => r.data.data as DriveItem[]),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/trash/${id}/restore`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trash() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/trash/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trash() }),
  });

  const emptyMutation = useMutation({
    mutationFn: () => apiClient.delete("/trash"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trash() }),
  });

  const batchRestoreMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(Array.from(selectedIds).map((id) => apiClient.post(`/trash/${id}/restore`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trash() });
      setSelectedIds(new Set());
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      await apiClient.post("/trash/bulk-permanent", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trash() });
      setSelectedIds(new Set());
    },
  });

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const totalSize = items.reduce((a, i) => a + i.size, 0);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Trash2 className="h-4 w-4" />
          <h1 className="font-semibold">Trash</h1>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          {totalSize > 0 && <span className="text-xs text-muted-foreground">{formatBytes(totalSize)}</span>}
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
              <Button size="sm" className="h-7" onClick={() => batchRestoreMutation.mutate()} disabled={batchRestoreMutation.isPending}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
              </Button>
              <Button variant="destructive" size="sm" className="h-7" onClick={() => { if (confirm(`Permanently delete ${selectedIds.size} items?`)) batchDeleteMutation.mutate(); }}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search trash..."
              className="pl-8 h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                {sortBy === "name" ? "Name" : sortBy === "size" ? "Size" : "Date"}
                {sortDir === "asc" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleSort("name")}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleSort("size")}>Size</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleSort("deletedAt")}>Date Deleted</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode((prev) => (prev === "list" ? "grid" : "list"))}>
            {viewMode === "list" ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
          </Button>
          {items.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => { if (confirm("Permanently delete all items in trash?")) emptyMutation.mutate(); }} disabled={emptyMutation.isPending}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Empty
            </Button>
          )}
        </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border p-3 space-y-2">
                <div className="h-10 w-10 rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground select-none">
            <div className="rounded-full bg-muted/80 p-4 mb-4">
              <Trash2 className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm font-medium">Trash is empty</p>
            <p className="text-xs mt-1 text-muted-foreground/70">Deleted files will appear here</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Search className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No results for &quot;{search}&quot;</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
            {filtered.map((item) => (
              <div key={item.id} className={cn(
                "flex flex-col items-center p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer group transition-colors",
                selectedIds.has(item.id) && "bg-muted/70 border-primary"
              )} onClick={() => toggleSelect(item.id)}>
                <div className="rounded-lg bg-muted/60 p-2.5 mb-2">
                  {getFileIcon(item)}
                </div>
                <p className="text-xs font-medium text-center w-full truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatBytes(item.size)}</p>
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); restoreMutation.mutate(item.id); }}
                    disabled={restoreMutation.isPending}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                    onClick={(e) => { e.stopPropagation(); if (confirm(`Permanently delete "${item.name}"?`)) deleteMutation.mutate(item.id); }}
                    disabled={deleteMutation.isPending}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
