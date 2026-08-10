"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  File, Folder, Upload, Trash2, Search, FolderPlus, Cloud, CloudOff,
  Download, Edit3, HardDrive, LayoutGrid, List, MoreHorizontal,
  Image, Film, Music, Archive, Code, FileText, RefreshCw, ArrowUpRight,
  ChevronRight, Database, Eye, Play, Share2, BarChart2, CheckSquare, Square, Images,
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
import { BatchRenameModal } from "@/components/batch-rename-modal";
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
  const [searchInput, setSearchInput] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingFile, setEditingFile] = useState<{ id: string; name: string } | null>(null);
  const [previewMediaItem, setPreviewMediaItem] = useState<DriveItem | null>(null);
  const [shareItem, setShareItem] = useState<DriveItem | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "shelf">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClick = useRef(false);



  // Long-press (touch/mobile): masuk mode pilih + pilih item, tanpa trigger click lanjutan
  const onRowPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    longPressOrigin.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      suppressNextClick.current = true;
      setSelectionMode(true);
      toggleSelect(id);
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    longPressOrigin.current = null;
  };
  const onRowPointerMove = (e: React.PointerEvent) => {
    if (!longPressTimer.current || !longPressOrigin.current) return;
    if (Math.hypot(e.clientX - longPressOrigin.current.x, e.clientY - longPressOrigin.current.y) > 10) cancelLongPress();
  };

  // Debounce search 300ms to avoid refetch storm
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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

  const { data: dashboardStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiClient.get("/dashboard/stats").then((r) => r.data.data),
    staleTime: 15_000,
  });

  const activeChannelsCount = dashboardStats?.telegramStorage?.channelsCount ?? usage?.folderCount ?? 0;
  const encryptedCount = dashboardStats?.securityMetrics?.encryptedCount ?? items.filter((i) => i.isEncrypted).length;
  const apiHealthLatencyMs = dashboardStats?.hardwareDetailed?.eventLoopLatencyMs ? Number((dashboardStats.hardwareDetailed.eventLoopLatencyMs as number).toFixed(1)) : 0;
  const bandwidthTodayBytes = ((dashboardStats?.activity7Days as any[]) ?? []).reduce((sum, day) => sum + ((day.uploadMB ?? 0) + (day.downloadMB ?? 0)) * 1024 * 1024, 0);

  // Eksekusi upload satu file ke taskId tertentu (dipakai untuk upload awal & retry)
  const runUpload = useCallback(
    async (file: File, taskId: string) => {
      const formData = new FormData();
      formData.append("file", file);
      if (parentId) formData.append("parent_id", parentId);

      try {
        const res = await apiClient.post("/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              uploadManager.updateProgress(taskId, percent, progressEvent.loaded);
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
    [parentId, uploadManager]
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const taskId = `${Date.now()}-${Math.random()}`;
      uploadManager.addTask({
        id: taskId,
        name: file.name,
        size: file.size,
        file,
        retry: () => {
          runUpload(file, taskId).catch(() => {});
        },
      });
      await runUpload(file, taskId);
      return true;
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
      setSelectionMode(false);
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async (targetId: string | null) => {
      await Promise.all(Array.from(selectedIds).map((id) =>
        apiClient.patch(`/files/${id}`, { parent_id: targetId })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage() });
      setSelectedIds(new Set());
      setSelectionMode(false);
    },
  });

  // Daftar folder tujuan untuk bulk move (folder level atas)
  const { data: moveTargets = [] } = useQuery({
    queryKey: ["folders", "move-targets"],
    queryFn: () =>
      apiClient.get("/files", { params: { parent_id: undefined } })
        .then((r) => (r.data.data as DriveItem[]).filter((i) => i.kind === "folder")),
    enabled: selectionMode || selectedIds.size > 0,
    staleTime: 60_000,
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

  // Keyboard shortcuts: Esc keluar mode pilih, Ctrl/Cmd+A pilih semua,
  // Delete kirim terpilih ke Trash, Enter buka item, "/" fokus pencarian,
  // 1/2/3 ganti tampilan, T toggle mode pilih.
  const sortedItemsRef = useRef(sortedItems);
  sortedItemsRef.current = sortedItems;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || active?.isContentEditable;

      if (e.key === "Escape") {
        if (selectionMode || selectedIds.size > 0) {
          setSelectionMode(false);
          setSelectedIds(new Set());
          e.preventDefault();
        } else if (typing) {
          // Lepas fokus dari input pencarian/folder
          (active as HTMLElement)?.blur?.();
          e.preventDefault();
        }
        return;
      }

      if (typing) {
        if (e.key === "Enter" && tag === "INPUT" && newFolderName.trim()) {
          createFolderMutation.mutate(newFolderName.trim());
        }
        return;
      }

      // Ctrl/Cmd+A — pilih semua item terfilter
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectionMode(true);
        setSelectedIds(new Set(sortedItemsRef.current.map((i) => i.id)));
        return;
      }

      // Delete — buang terpilih ke Trash
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          if (confirm(`Hapus ${selectedIds.size} item ke Trash?`)) batchDeleteMutation.mutate();
        }
        return;
      }

      // Enter — buka folder / preview file pertama yang dipilih
      if (e.key === "Enter") {
        const target = selectedIds.size > 0
          ? sortedItemsRef.current.find((i) => selectedIds.has(i.id))
          : sortedItemsRef.current[0];
        if (!target) return;
        e.preventDefault();
        if (target.kind === "folder") router.push(`/drive/${target.id}`);
        else setPreviewMediaItem(target);
        return;
      }

      // "/" — fokus pencarian
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 1/2/3 — ganti tampilan list/grid/shelf
      if (e.key === "1") setViewMode("list");
      if (e.key === "2") setViewMode("grid");
      if (e.key === "3") setViewMode("shelf");

      // T — toggle mode pilih
      if (e.key.toLowerCase() === "t") {
        if (selectionMode) setSelectedIds(new Set());
        setSelectionMode((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectionMode, selectedIds, newFolderName, createFolderMutation, batchDeleteMutation, router]);

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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const fileList = Array.from(files);
      for (const file of fileList) {
        await uploadMutation.mutateAsync(file).catch(() => {});
      }
    },
    [uploadMutation]
  );

  // Upload folder: baca webkitRelativePath, buat struktur folder di API, upload tiap file
  const handleFolderUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;

      const mkdir = async (name: string, parent: string | null): Promise<string> => {
        const res = await apiClient.post("/folders", { name, parent_id: parent });
        return (res.data?.data as DriveItem).id;
      };

      // Map relPath (tanpa nama file) -> folderId
      const dirCache = new Map<string, string | null>();
      dirCache.set("", parentId); // root dari upload = folder saat ini

      for (const file of files) {
        const rel = file.webkitRelativePath || file.name;
        const parts = rel.split("/");
        const fileName = parts.pop() ?? file.name;
        const dirPath = parts.join("/");

        // Buat folder-folder yang belum ada (bertahap dari atas)
        let cursor = "";
        for (const part of parts) {
          const nextPath = cursor ? `${cursor}/${part}` : part;
          if (!dirCache.has(nextPath)) {
            const created = await mkdir(part, dirCache.get(cursor) ?? null).catch(() => null);
            dirCache.set(nextPath, created); // null = gagal buat → upload ke parent terakhir
          }
          cursor = nextPath;
        }

        const targetParent = dirCache.get(dirPath) ?? null;
        const formData = new FormData();
        formData.append("file", file);
        if (targetParent) formData.append("parent_id", targetParent);

        const taskId = `${Date.now()}-${Math.random()}`;
        uploadManager.addTask({ id: taskId, name: `${dirPath ? dirPath + "/" : ""}${fileName}`, size: file.size });
        try {
          await apiClient.post("/files/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (p) => {
              if (p.total) uploadManager.updateProgress(taskId, Math.round((p.loaded * 100) / p.total), p.loaded);
            },
          });
          uploadManager.setTaskStatus(taskId, "completed");
        } catch (err: any) {
          uploadManager.setTaskStatus(taskId, "error", err.message);
        }
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage() });
    },
    [parentId, uploadManager, queryClient]
  );

  // Paste screenshot / file dari clipboard → langsung upload
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      for (const file of files) {
        await uploadMutation.mutateAsync(file).catch(() => {});
      }
    },
    [uploadMutation]
  );

  // Paste global (Ctrl+V / ⌘V) di mana pun di halaman drive — hanya saat clipboard berisi FILE
  useEffect(() => {
    const onGlobalPaste = (e: ClipboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || active?.isContentEditable) return;
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        for (const file of Array.from(e.clipboardData.files)) {
          uploadMutation.mutateAsync(file).catch(() => {});
        }
      }
    };
    window.addEventListener("paste", onGlobalPaste);
    return () => window.removeEventListener("paste", onGlobalPaste);
  }, [uploadMutation]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 pb-fab" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onPaste={handlePaste}>
        {/* Drop overlay — tampil saat drag file masuk area drive */}
        {isDragging && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in-0 duration-150"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-emerald-500/60 bg-card/90 backdrop-blur-md px-10 py-10 shadow-2xl text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center animate-bounce">
                <Upload className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Lepaskan untuk Mengunggah</p>
                <p className="text-xs text-muted-foreground mt-1">File akan disimpan di folder ini</p>
              </div>
            </div>
          </div>
        )}
        {/* Supabase-inspired Stats Grid */}
        <StatsGrid
          totalFiles={usage?.fileCount ?? items.length}
          totalStorageBytes={usage?.totalSize ?? 0}
          encryptedCount={encryptedCount}
          activeChannelsCount={activeChannelsCount}
          bandwidthTodayBytes={bandwidthTodayBytes}
          apiHealthLatencyMs={apiHealthLatencyMs}
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
            <div className="flex items-center gap-1.5 ml-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{selectedIds.size} dipilih</Badge>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => {
                  const all = sortedItems.filter((i) => !selectedIds.has(i.id)).map((i) => i.id);
                  setSelectedIds((prev) => { const n = new Set(prev); all.forEach((id) => n.add(id)); return n; });
                }}>
                <CheckSquare className="h-3.5 w-3.5 mr-1" /> Semua
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <FolderPlus className="h-3.5 w-3.5 mr-1" /> Pindah
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => bulkMoveMutation.mutate(null)}>Root</DropdownMenuItem>
                  {moveTargets.map((f) => (
                    <DropdownMenuItem key={f.id} onClick={() => bulkMoveMutation.mutate(f.id)}>{f.name}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => setShowBatchRename(true)}>
                <Edit3 className="h-3.5 w-3.5 mr-1" /> Rename
              </Button>
              <Button variant="destructive" size="sm" className="h-7 text-xs"
                onClick={() => { if (confirm(`Hapus ${selectedIds.size} item ke Trash?`)) batchDeleteMutation.mutate(); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSelectedIds(new Set()); setSelectionMode(false); }}>Batal</Button>
            </div>
          )}
          {usage && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
              <Database className="h-3 w-3" />
              <span>{usage.fileCount} files · {formatBytes(usage.totalSize)}</span>
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-0 md:w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input ref={searchInputRef} placeholder='Cari: nama, type:image, size:>50MB...  (/ untuk fokus)' value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
            <Button variant={showAnalytics ? "secondary" : "outline"} size="sm" className="h-8 w-8 p-0 shrink-0 md:w-auto md:px-3 md:text-xs" onClick={() => setShowAnalytics(!showAnalytics)} aria-label="Analytics">
              <BarChart2 className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden md:inline">Analytics</span>
            </Button>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-end">
            {(["name", "size", "date"] as const).map((field) => (
              <Button key={field} variant={sortBy === field ? "secondary" : "ghost"} size="sm" className="h-8 text-[11px] px-1.5 sm:h-7 sm:text-xs sm:px-2" onClick={() => toggleSort(field)}>
                {field === "name" ? "Name" : field === "size" ? "Size" : "Date"}
                {sortBy === field && <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </Button>
            ))}
          </div>
          <div className="flex border border-border rounded-md">
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-r-none" onClick={() => setViewMode("list")} aria-label="Tampilan daftar">
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-none border-x border-border" onClick={() => setViewMode("grid")} aria-label="Tampilan grid">
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "shelf" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-l-none" onClick={() => setViewMode("shelf")} aria-label="Tampilan galeri (shelf)">
              <Images className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant={selectionMode ? "secondary" : "outline"} size="sm" className="h-8 w-8 p-0 shrink-0 sm:w-auto sm:px-2.5 sm:text-xs"
            onClick={() => { if (selectionMode) { setSelectedIds(new Set()); } setSelectionMode(!selectionMode); }}
            aria-label="Mode pilih banyak" title="Mode pilih banyak (multiselect)">
            <CheckSquare className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Pilih</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs" onClick={() => setShowNewFolder(true)} aria-label="Buat folder">
            <FolderPlus className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Folder</span>
          </Button>
          <Button size="sm" className="h-8 px-2 sm:px-3 text-xs" onClick={() => fileInputRef.current?.click()} aria-label="Upload file">
            <Upload className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Upload</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs" onClick={() => folderInputRef.current?.click()} aria-label="Upload folder">
            <FolderPlus className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Upload Folder</span>
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          <input ref={folderInputRef} type="file" multiple {...({ webkitdirectory: "" } as any)} className="hidden" onChange={handleFolderUpload} />
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
            <Input placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="h-8 w-full sm:w-64" autoFocus
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
                    <div className={cn("flex items-center gap-2 sm:gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer group transition-colors select-none", selectedIds.has(item.id) && "bg-muted/70")}
                      onClick={(e) => {
                        if (suppressNextClick.current) { suppressNextClick.current = false; return; }
                        if (selectionMode) { toggleSelect(item.id); return; }
                        if (e.ctrlKey || e.metaKey) { toggleSelect(item.id); return; }
                        if (item.kind === "folder") router.push(`/drive/${item.id}`);
                      }}
                      onDoubleClick={() => { if (item.kind === "folder") router.push(`/drive/${item.id}`); }}
                      onPointerDown={onRowPointerDown(item.id)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      onPointerMove={onRowPointerMove}>
                      {(selectionMode || selectedIds.has(item.id)) && (
                        <span className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                          {selectedIds.has(item.id)
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 text-muted-foreground" />}
                        </span>
                      )}
                      {getFileIcon(item)}
                      <div className="flex-1 min-w-0"><p title={item.name} className="text-sm truncate font-medium">{item.name}</p></div>
                      {item.kind === "file" && (
                        <>
                          <span className="hidden sm:inline-flex shrink-0"><SyncBadge status={item.syncStatus} /></span>
                          <span className="sm:hidden shrink-0" title={item.syncStatus === "sync_failed" ? "Sync gagal" : item.syncStatus === "local" ? "Belum di-sync" : item.syncStatus === "syncing" ? "Menyinkronkan..." : "Tersinkron"}>
                            {item.syncStatus === "sync_failed" && <span className="block h-2 w-2 rounded-full bg-red-500" />}
                            {item.syncStatus === "local" && <span className="block h-2 w-2 rounded-full bg-amber-500" />}
                            {item.syncStatus === "syncing" && <span className="block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
                            {item.syncStatus === "synced" && <span className="block h-2 w-2 rounded-full bg-green-500/70" />}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0 w-16 text-right tabular-nums hidden sm:block">
                        {item.kind === "file" ? formatBytes(item.size) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 w-24 text-right hidden md:block">
                        {new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                        <div className="hidden sm:flex sm:items-center sm:gap-0.5">
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
                        </div>
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
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
              {sortedItems.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger>
                    <div className={cn("flex flex-col items-center p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer group transition-colors relative select-none",
                        selectedIds.has(item.id) && "bg-muted/70 border-primary")}
                      onClick={(e) => {
                        if (suppressNextClick.current) { suppressNextClick.current = false; return; }
                        if (selectionMode) { toggleSelect(item.id); return; }
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
                      }}
                      onPointerDown={onRowPointerDown(item.id)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      onPointerMove={onRowPointerMove}>
                      {(selectionMode || selectedIds.has(item.id)) && (
                        <span className="absolute top-1.5 left-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                          {selectedIds.has(item.id)
                            ? <CheckSquare className="h-4 w-4 text-primary" />
                            : <Square className="h-4 w-4 text-muted-foreground" />}
                        </span>
                      )}
                      <div className="relative mb-2">
                        <div className="rounded-lg bg-muted/60 p-2.5">
                          {item.kind === "folder" ? <Folder className="h-8 w-8 text-blue-500" /> : (
                            <div className="flex items-center justify-center h-8 w-8">{getFileIcon(item)}</div>
                          )}
                        </div>
                        {item.kind === "file" && <div className="absolute -bottom-1 -right-1"><SyncBadge status={item.syncStatus} /></div>}
                      </div>
                      <p title={item.name} className="text-xs font-medium text-center w-full line-clamp-2 break-words mt-1">{item.name}</p>
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
          ) : (
            /* Shelf / Gallery view — kolase foto rapat */
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 p-2">
              {sortedItems.map((item) => {
                const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
                const isImage = item.kind === "file" && ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
                return (
                  <div
                    key={item.id}
                    title={item.name}
                    className={cn(
                      "group relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/40 cursor-pointer transition-all select-none",
                      selectedIds.has(item.id) && "ring-2 ring-primary border-primary"
                    )}
                    onClick={(e) => {
                      if (suppressNextClick.current) { suppressNextClick.current = false; return; }
                      if (selectionMode) { toggleSelect(item.id); return; }
                      if (item.kind === "folder") { router.push(`/drive/${item.id}`); return; }
                      setPreviewMediaItem(item);
                    }}
                    onDoubleClick={() => { if (item.kind === "folder") router.push(`/drive/${item.id}`); else setPreviewMediaItem(item); }}
                    onPointerDown={onRowPointerDown(item.id)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerMove={onRowPointerMove}
                  >
                    {isImage ? (
                      <img
                        src={`/api/files/${item.id}/download?inline=true`}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted/30">
                        {item.kind === "folder"
                          ? <Folder className="h-6 w-6 text-blue-500" />
                          : <File className="h-6 w-6 text-muted-foreground" />}
                        <span className="text-[9px] px-1 text-center truncate max-w-full">{item.name}</span>
                      </div>
                    )}
                    {(selectionMode || selectedIds.has(item.id)) && (
                      <span className="absolute top-1 left-1 z-10 bg-background/80 rounded" onClick={(e) => e.stopPropagation()}>
                        {selectedIds.has(item.id)
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4 text-muted-foreground" />}
                      </span>
                    )}
                    {item.kind === "file" && !isImage && (
                      <span className="absolute bottom-1 right-1"><SyncBadge status={item.syncStatus} /></span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span>{sortedItems.length} item{sortedItems.length !== 1 ? "s" : ""}{search && " (filtered)"}</span>
          <span className="hidden sm:flex items-center gap-3 text-[10px]">
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-background">Ctrl+A</kbd> pilih semua</span>
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-background">Del</kbd> trash</span>
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-background">Enter</kbd> buka</span>
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-background">/</kbd> cari</span>
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-background">1</kbd><kbd className="px-1 py-0.5 rounded border border-border bg-background ml-0.5">2</kbd><kbd className="px-1 py-0.5 rounded border border-border bg-background ml-0.5">3</kbd> view</span>
          </span>
          <span>{items.filter((i) => i.kind === "file").reduce((a, i) => a + i.size, 0) > 0
            ? `Total: ${formatBytes(items.filter((i) => i.kind === "file").reduce((a, i) => a + i.size, 0))}` : ""}</span>
        </div>

        {editingFile && <TextEditorDialog fileId={editingFile.id} fileName={editingFile.name} onClose={() => setEditingFile(null)} />}
        {showBatchRename && (
          <BatchRenameModal
            selectedItemIds={Array.from(selectedIds)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) });
              queryClient.refetchQueries({ queryKey: queryKeys.files(parentId) });
              setSelectedIds(new Set());
              setSelectionMode(false);
              setShowBatchRename(false);
            }}
            onClose={() => setShowBatchRename(false)}
          />
        )}
        {previewMediaItem && <MediaPreviewDialog item={previewMediaItem} onClose={() => setPreviewMediaItem(null)} />}
        <ShareDialog item={shareItem} open={!!shareItem} onOpenChange={(open) => !open && setShareItem(null)} onUpdated={() => queryClient.invalidateQueries({ queryKey: queryKeys.files(parentId) })} />
      </div>
    </TooltipProvider>
  );
}
