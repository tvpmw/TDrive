"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useState, useCallback, useRef } from "react";
import {
  File, Folder, Upload, Trash2, Search, FolderPlus, Cloud, CloudOff,
  Download, Edit3, HardDrive, LayoutGrid, List, MoreHorizontal,
  Image, Film, Music, Archive, Code, FileText, RefreshCw, ArrowUpRight,
  ChevronRight, Database, Eye, Play, Share2, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TextEditorDialog } from "@/components/text-editor-dialog";
import { MediaPreviewDialog } from "@/components/media-preview-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { StorageAnalytics } from "@/components/storage-analytics";
import { StatsGrid } from "@/components/stats-grid";
import { useUploadManager } from "@/components/upload-manager";
import { SmartFolders } from "@/components/smart-folders";
import { CommandPaletteTrigger } from "@/components/command-palette";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, cn } from "@/lib/utils";
import type { DriveItem } from "@tdrive/shared";
import { useRouter } from "next/navigation";

function getFileIcon(item: DriveItem) {
  if (item.kind === "folder") return <Folder className="h-5 w-5 text-blue-500" />;
  const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext))
    return <Image className="h-5 w-5 text-pink-400" />;
  if (["mp4", "avi", "mkv", "mov", "webm", "flv"].includes(ext))
    return <Film className="h-5 w-5 text-purple-400" />;
  if (["mp3", "wav", "flac", "ogg", "aac", "m4a"].includes(ext))
    return <Music className="h-5 w-5 text-orange-400" />;
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext))
    return <Archive className="h-5 w-5 text-yellow-500" />;
  if (["js", "ts", "jsx", "tsx", "py", "go", "rs", "java", "c", "cpp", "h", "css", "html"].includes(ext))
    return <Code className="h-5 w-5 text-green-400" />;
  if (["md", "txt", "doc", "docx", "pdf", "rtf"].includes(ext))
    return <FileText className="h-5 w-5 text-cyan-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function SyncBadge({ status }: { status: DriveItem["syncStatus"] }) {
  if (status === "synced")
    return (
      <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-500 bg-green-500/10 gap-0.5 px-1.5 py-0">
        <Cloud className="h-2.5 w-2.5" /> Synced
      </Badge>
    );
  if (status === "local")
    return (
      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500 bg-amber-500/10 gap-0.5 px-1.5 py-0">
        <CloudOff className="h-2.5 w-2.5" /> Local
      </Badge>
    );
  if (status === "syncing")
    return (
      <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-500 bg-blue-500/10 gap-0.5 px-1.5 py-0">
        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Syncing
      </Badge>
    );
  if (status === "sync_failed")
    return (
      <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0">
        Failed
      </Badge>
    );
  return null;
}

export function DriveExplorer({ folderId }: { folderId?: string }) {
  const parentId = folderId ?? null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const uploadManager = useUploadManager();
  const [search, setSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingFile, setEditingFile] = useState<{ id: string; name: string } | null>(null);
  const [previewMediaItem, setPreviewMediaItem] = useState<DriveItem | null>(null);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.files(parentId),
    queryFn: () =>
      apiClient
        .get("/files", {
          params: {
            parent_id: parentId || undefined,
            search: search || undefined,
            recursive: !!search || categoryFilter !== "all",
          },
        })
        .then((r) => r.data.data as DriveItem[]),
    refetchInterval: 3000, // ⚡ Auto-sync polling every 3 seconds for instant background updates
  });

  const { data: breadcrumbPath = [] } = useQuery({
    queryKey: queryKeys.folderPath(parentId ?? "root"),
    queryFn: () =>
      apiClient.get(`/folders/${parentId}/path`).then((r) => r.data.data as { id: string; name: string }[]),
    enabled: !!parentId,
  });

  const { data: usage } = useQuery({
    queryKey: queryKeys.storageUsage(),
    queryFn: () => apiClient.get("/folders/stats/usage").then((r) => r.data.data as { totalSize: number; fileCount: number; folderCount: number }),
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const taskId = `${Date.now()}-${Math.random()}`;
      uploadManager.addTask({ id: taskId, name: file.name, size: file.size });

      const formData = new FormData();
      formData.append("file", file);
      if (parentId) formData.append("parent_id", parentId);

      try {
        const res = await apiClient.post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              uploadManager.updateProgress(taskId, percent);
            }
          },
        });
        uploadManager.setTaskStatus(taskId, "completed");
        return res.data;
      } catch (err: any) {
        uploadManager.setTaskStatus(taskId, "error", err.message);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage() });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post("/folders", { name, parent_id: parentId }).then((r) => r.data.data as DriveItem),
    onMutate: async (newFolderName) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.files(parentId) });
      const previousItems = queryClient.getQueryData<DriveItem[]>(queryKeys.files(parentId)) || [];
      const tempFolder: DriveItem = {
        id: `temp-${Date.now()}`,
        userId: "temp-user",
        name: newFolderName,
        kind: "folder",
        parentId: parentId,
        mimeType: null,
        size: 0,
        storage: { provider: "telegram-supergroup-topic", remoteId: null, channelName: "TeleDrive Storage" },
        syncStatus: "synced",
        syncError: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<DriveItem[]>(queryKeys.files(parentId), (old) => [tempFolder, ...(old || [])]);
      return { previousItems };
    },
    onError: (err, newFolderName, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.files(parentId), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage() });
      setShowNewFolder(false);
      setNewFolderName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage() });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/files/${id}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(Array.from(selectedIds).map((id) => apiClient.delete(`/files/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage() });
      setSelectedIds(new Set());
    },
  });

  const sortedItems = items
    .filter((item) => {
      // Advanced Search Clause Parsing
      let targetSearch = search.toLowerCase();
      let matchesSearch = true;

      if (search.includes("type:")) {
        const typeMatch = search.match(/type:(\w+)/i)?.[1];
        if (typeMatch && item.kind === "file") {
          const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
          if (typeMatch === "image" && !["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) matchesSearch = false;
          if (typeMatch === "video" && !["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) matchesSearch = false;
          if (typeMatch === "pdf" && ext !== "pdf") matchesSearch = false;
        }
        targetSearch = targetSearch.replace(/type:\w+/i, "").trim();
      }

      if (search.includes("size:>")) {
        const sizeMb = parseInt(search.match(/size:>(\d+)mb/i)?.[1] || "0", 10);
        if (sizeMb && item.size < sizeMb * 1024 * 1024) matchesSearch = false;
        targetSearch = targetSearch.replace(/size:>\d+mb/i, "").trim();
      }

      if (targetSearch && !item.name.toLowerCase().includes(targetSearch)) {
        matchesSearch = false;
      }

      if (categoryFilter === "all") return true;
      if (categoryFilter === "starred") return item.isStarred === 1;
      if (categoryFilter === "large") return item.kind === "file" && item.size > 10 * 1024 * 1024;
      if (categoryFilter === "recent" || categoryFilter === "archive") return item.kind === "file";
      if (item.kind === "folder") return false;
      const ext = item.name.includes(".") ? item.name.split(".").pop()?.toLowerCase() ?? "" : "";
      if (categoryFilter === "images" || categoryFilter === "photos") return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext);
      if (categoryFilter === "videos") return ["mp4", "mkv", "avi", "mov", "webm", "flv"].includes(ext);
      if (categoryFilter === "audio" || categoryFilter === "music") return ["mp3", "wav", "flac", "ogg", "m4a", "aac"].includes(ext);
      if (categoryFilter === "documents") return ["pdf", "doc", "docx", "txt", "rtf", "md", "xls", "xlsx", "ppt", "pptx", "json", "csv", "log"].includes(ext);
      if (categoryFilter === "archives") return ["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext);
      if (categoryFilter === "apk") return ext === "apk";
      return false;
    })
    .sort((a, b) => {
      if (a.kind === "folder" && b.kind !== "folder") return -1;
      if (a.kind !== "folder" && b.kind === "folder") return 1;
      const cmp =
        sortBy === "name" ? a.name.localeCompare(b.name)
          : sortBy === "size" ? a.size - b.size
            : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (field: "name" | "size" | "date") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("asc"); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startDownload = (item: DriveItem) => {
    apiClient.get(`/files/${item.id}/download`, { responseType: "blob" }).then((r) => {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = item.name; a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const fileList = Array.from(files);
      e.target.value = "";
      for (const file of fileList) {
        await uploadMutation.mutateAsync(file).catch(() => {});
      }
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const fileList = Array.from(files);
      for (const file of fileList) {
        await uploadMutation.mutateAsync(file).catch(() => {});
      }
    },
    [uploadMutation]
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        {/* Supabase-inspired Stats Grid */}
        <StatsGrid
          totalFiles={usage?.fileCount ?? items.length}
          totalStorageBytes={usage?.totalSize ?? 0}
          encryptedCount={items.filter((i) => i.isEncrypted).length}
          activeChannelsCount={1}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              <span className="font-medium">Drive</span>
            </div>
            <CommandPaletteTrigger />
          </div>
          {/* Breadcrumb */}
          {parentId && breadcrumbPath.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground ml-1">
              <button onClick={() => router.push("/drive")} className="hover:text-foreground cursor-pointer text-xs">
                Root
              </button>
              {breadcrumbPath.map((crumb, i) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button
                    onClick={() => router.push(`/drive/${crumb.id}`)}
                    className="hover:text-foreground cursor-pointer text-xs max-w-[120px] truncate"
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
              <Button variant="destructive" size="sm" className="h-7"
                onClick={() => { if (confirm(`Delete ${selectedIds.size} items?`)) batchDeleteMutation.mutate(); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}
          {usage && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
              <Database className="h-3 w-3" />
              <span>{usage.fileCount} files · {formatBytes(usage.totalSize)}</span>
            </div>
          )}
          <div className="flex-1" />
          <div className="relative w-72">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder='Cari: nama, type:image, size:>50MB...' value={search} onChange={(e) => setSearch(e.target.value)} className="pl-7 h-8 text-xs" />
          </div>
          <div className="flex items-center gap-0.5">
            {(["name", "size", "date"] as const).map((field) => (
              <Button key={field} variant={sortBy === field ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-2" onClick={() => toggleSort(field)}>
                {field === "name" ? "Name" : field === "size" ? "Size" : "Date"}
                {sortBy === field && <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </Button>
            ))}
          </div>
          <div className="flex border border-border rounded-md">
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-r-none" onClick={() => setViewMode("list")}>
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-l-none" onClick={() => setViewMode("grid")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant={showAnalytics ? "secondary" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setShowAnalytics(!showAnalytics)}>
            <BarChart2 className="h-3.5 w-3.5 mr-1" /> Analytics
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewFolder(true)}>
            <FolderPlus className="h-3.5 w-3.5 mr-1" /> Folder
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>

        {/* Smart Virtual Folders */}
        <SmartFolders activeFilter={categoryFilter} onSelectFilter={(f) => setCategoryFilter(f)} />

        {/* Media Gallery Category Filter Pills */}
        <div className="flex items-center gap-1.5 px-1 py-1.5 overflow-x-auto text-xs scrollbar-none border-b border-border/40">
          {[
            { id: "all", label: "Semua", icon: "📁" },
            { id: "photos", label: "Photos", icon: "🖼️" },
            { id: "videos", label: "Videos", icon: "🎥" },
            { id: "documents", label: "Documents", icon: "📄" },
            { id: "music", label: "Music", icon: "🎵" },
            { id: "archives", label: "Archives", icon: "📦" },
            { id: "apk", label: "APK", icon: "🤖" },
            { id: "starred", label: "Favorites", icon: "⭐" },
          ].map((cat) => (
            <Badge
              key={cat.id}
              variant={categoryFilter === cat.id ? "default" : "outline"}
              className={cn(
                "cursor-pointer px-2.5 py-1 text-[11px] font-medium transition-all gap-1.5 rounded-md",
                categoryFilter === cat.id
                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                  : "bg-card/40 hover:bg-muted text-muted-foreground border-border/50"
              )}
              onClick={() => setCategoryFilter(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </Badge>
          ))}
        </div>

        {showAnalytics && (
          <div className="p-3 border-b border-border bg-muted/10">
            <StorageAnalytics />
          </div>
        )}

        {showNewFolder && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="h-8 w-64" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim()); if (e.key === "Escape") setShowNewFolder(false); }} />
            <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
          </div>
        )}

        {uploadMutation.isPending && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs">
            <RefreshCw className="h-3 w-3 animate-spin" /> Uploading...
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border p-3 space-y-2">
                  <div className="h-10 w-10 rounded bg-muted" />
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground select-none">
              <div className="rounded-full bg-muted/80 p-4 mb-4">
                {search ? <Search className="h-8 w-8 opacity-40" /> : <Folder className="h-8 w-8 opacity-40" />}
              </div>
              <p className="text-sm font-medium">{search ? "No files match your search" : "This folder is empty"}</p>
              <p className="text-xs mt-1 text-muted-foreground/70">{search ? "Try a different search term" : "Drop files here or click Upload"}</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="divide-y divide-border">
              {sortedItems.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger>
                    <div className={cn("flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer group transition-colors", selectedIds.has(item.id) && "bg-muted/70")}
                      onClick={(e) => { if (e.ctrlKey || e.metaKey) { toggleSelect(item.id); return; } if (item.kind === "folder") router.push(`/drive/${item.id}`); }}
                      onDoubleClick={() => { if (item.kind === "folder") router.push(`/drive/${item.id}`); }}>
                      {selectedIds.has(item.id) && <div className="h-4 w-4 rounded border-2 border-primary bg-primary/20 shrink-0" />}
                      {getFileIcon(item)}
                      <div className="flex-1 min-w-0"><p className="text-sm truncate font-medium">{item.name}</p></div>
                      {item.kind === "file" && <SyncBadge status={item.syncStatus} />}
                      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right tabular-nums">
                        {item.kind === "file" ? formatBytes(item.size) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 w-24 text-right">
                        {new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.kind === "file" && (
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); startDownload(item); }}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent>Download</TooltipContent></Tooltip>
                        )}
                        {item.kind === "file" && item.syncStatus !== "synced" && item.syncStatus !== "syncing" && (
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); syncMutation.mutate(item.id); }} disabled={syncMutation.isPending}>
                              <Cloud className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent>Sync to Telegram</TooltipContent></Tooltip>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.kind === "folder" && (
                              <DropdownMenuItem onClick={() => router.push(`/drive/${item.id}`)}>
                                <ArrowUpRight className="h-4 w-4 mr-2" /> Open
                              </DropdownMenuItem>
                            )}
                            {item.kind === "file" && (
                              <>
                                <DropdownMenuItem onClick={() => setPreviewMediaItem(item)}>
                                  <Eye className="h-4 w-4 mr-2 text-primary" /> Pratinjau Media
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => startDownload(item)}>
                                  <Download className="h-4 w-4 mr-2" /> Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingFile({ id: item.id, name: item.name })}>
                                  <Edit3 className="h-4 w-4 mr-2" /> Edit Text
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShareItem(item)}>
                                  <Share2 className="h-4 w-4 mr-2 text-blue-500" /> Bagikan Link
                                </DropdownMenuItem>
                                {item.syncStatus !== "synced" && (
                                  <DropdownMenuItem onClick={() => syncMutation.mutate(item.id)}>
                                    <Cloud className="h-4 w-4 mr-2" /> Sync to Telegram
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Move to Trash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {item.kind === "folder" && <ContextMenuItem onClick={() => router.push(`/drive/${item.id}`)}>Open</ContextMenuItem>}
                    {item.kind === "file" && (
                      <>
                        <ContextMenuItem onClick={() => setPreviewMediaItem(item)}>Pratinjau Media</ContextMenuItem>
                        <ContextMenuItem onClick={() => startDownload(item)}>Download</ContextMenuItem>
                        <ContextMenuItem onClick={() => setEditingFile({ id: item.id, name: item.name })}>Edit Text</ContextMenuItem>
                        <ContextMenuItem onClick={() => setShareItem(item)}>Bagikan Link</ContextMenuItem>
                        {item.syncStatus !== "synced" && <ContextMenuItem onClick={() => syncMutation.mutate(item.id)}>Sync to Telegram</ContextMenuItem>}
                        <ContextMenuSeparator />
                      </>
                    )}
                    <ContextMenuItem onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">Move to Trash</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
              {sortedItems.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger>
                    <div className={cn("flex flex-col items-center p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer group transition-colors relative",
                        selectedIds.has(item.id) && "bg-muted/70 border-primary")}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) { toggleSelect(item.id); return; }
                        if (item.kind === "folder") { router.push(`/drive/${item.id}`); return; }
                        // Single click or double click preview
                        const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
                        if (["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mp3", "wav", "pdf"].includes(ext)) {
                          setPreviewMediaItem(item);
                        }
                      }}
                      onDoubleClick={() => {
                        if (item.kind === "folder") router.push(`/drive/${item.id}`);
                        else setPreviewMediaItem(item);
                      }}>
                      <div className="relative mb-2">
                        <div className="rounded-lg bg-muted/60 p-2.5">
                          {item.kind === "folder" ? <Folder className="h-8 w-8 text-blue-500" /> : (
                            <div className="flex items-center justify-center h-8 w-8">{getFileIcon(item)}</div>
                          )}
                        </div>
                        {item.kind === "file" && <div className="absolute -bottom-1 -right-1"><SyncBadge status={item.syncStatus} /></div>}
                      </div>
                      <p className="text-xs font-medium text-center w-full truncate mt-1">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.kind === "file" ? formatBytes(item.size) : "Folder"}</p>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {item.kind === "folder" && <ContextMenuItem onClick={() => router.push(`/drive/${item.id}`)}>Open</ContextMenuItem>}
                    {item.kind === "file" && (
                      <>
                        <ContextMenuItem onClick={() => setPreviewMediaItem(item)}>Pratinjau Media</ContextMenuItem>
                        <ContextMenuItem onClick={() => startDownload(item)}>Download</ContextMenuItem>
                        <ContextMenuItem onClick={() => setEditingFile({ id: item.id, name: item.name })}>Edit Text</ContextMenuItem>
                        <ContextMenuItem onClick={() => setShareItem(item)}>Bagikan Link</ContextMenuItem>
                        {item.syncStatus !== "synced" && <ContextMenuItem onClick={() => syncMutation.mutate(item.id)}>Sync to Telegram</ContextMenuItem>}
                        <ContextMenuSeparator />
                      </>
                    )}
                    <ContextMenuItem onClick={() => deleteMutation.mutate(item.id)} className="text-destructive">Move to Trash</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span>{sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}{search && " (filtered)"}</span>
          <span>{items.filter((i) => i.kind === "file").reduce((a, i) => a + i.size, 0) > 0
            ? `Total: ${formatBytes(items.filter((i) => i.kind === "file").reduce((a, i) => a + i.size, 0))}` : ""}</span>
        </div>

        {editingFile && <TextEditorDialog fileId={editingFile.id} fileName={editingFile.name} onClose={() => setEditingFile(null)} />}
        {previewMediaItem && <MediaPreviewDialog item={previewMediaItem} onClose={() => setPreviewMediaItem(null)} />}
        <ShareDialog item={shareItem} open={!!shareItem} onOpenChange={(open) => !open && setShareItem(null)} onUpdated={() => queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) })} />
      </div>
    </TooltipProvider>
  );
}
