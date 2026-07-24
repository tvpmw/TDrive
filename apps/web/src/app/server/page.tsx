"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/sidebar";
import {
  Server, Folder, File, AlertCircle, Upload, FolderPlus, ChevronRight,
  Download, Trash2, Edit3, MoreVertical, RefreshCw, ArrowLeft, Save, X,
  Search, Image, Film, Music, Archive, Code, FileText, List, LayoutGrid,
  Clock, HardDrive, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useCallback, useRef, useEffect } from "react";
import { formatBytes } from "@/lib/utils";

interface ServerFile {
  name: string;
  kind: "file" | "folder";
  size: number;
  path: string;
  modifiedAt: string;
}

interface ServerStatus {
  ready: boolean;
  mode: string;
  root: string;
}

export default function ServerPage() {
  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingText, setEditingText] = useState<{ path: string; name: string } | null>(null);
  const [textContent, setTextContent] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const { data: status } = useQuery({
    queryKey: queryKeys.serverFiles("status"),
    queryFn: () => apiClient.get("/server-files/status").then((r) => r.data.data as ServerStatus),
  });

  const { data: files = [], isLoading } = useQuery({
    queryKey: queryKeys.serverFiles(currentPath || "root"),
    queryFn: () =>
      apiClient
        .get("/server-files", { params: currentPath ? { path: currentPath } : {} })
        .then((r) => r.data.data as ServerFile[]),
    enabled: status?.ready ?? false,
  });

  const totalFiles = files.filter(f => f.kind === "file").length;
  const totalFolders = files.filter(f => f.kind === "folder").length;
  const totalSize = files.reduce((a, f) => a + f.size, 0);

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.post("/server-files/folders", { name, path: currentPath || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serverFiles(currentPath || "root") });
      setShowNewFolder(false);
      setNewFolderName("");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (currentPath) formData.append("path", currentPath);
      return apiClient.post("/server-files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serverFiles(currentPath || "root") }),
  });

  const deleteMutation = useMutation({
    mutationFn: (path: string) => apiClient.delete("/server-files", { params: { path } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.serverFiles(currentPath || "root") }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      apiClient.patch("/server-files", { path: oldPath, newPath }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serverFiles(currentPath || "root") });
      setRenaming(null);
    },
  });

  const textQuery = useQuery({
    queryKey: queryKeys.serverFiles(`text:${editingText?.path}`),
    queryFn: () =>
      apiClient.get("/server-files/text", { params: { path: editingText!.path } }).then((r) => r.data.data.content as string),
    enabled: !!editingText,
  });

  useEffect(() => {
    if (textQuery.data !== undefined) setTextContent(textQuery.data);
  }, [textQuery.data]);

  const saveTextMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      apiClient.put("/server-files/text", { path, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.serverFiles(currentPath || "root") });
      setEditingText(null);
    },
  });

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileUploads = e.target.files;
      if (!fileUploads) return;
      Array.from(fileUploads).forEach((f) => uploadMutation.mutate(f));
      e.target.value = "";
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      Array.from(e.dataTransfer.files).forEach((f) => uploadMutation.mutate(f));
    },
    [uploadMutation]
  );

  const handleDownload = (file: ServerFile) => {
    apiClient.get("/server-files/download", { params: { path: file.path }, responseType: "blob" }).then((r) => {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleOpenText = (file: ServerFile) => {
    setEditingText({ path: file.path, name: file.name });
  };

  const handleSaveText = () => {
    if (editingText) {
      saveTextMutation.mutate({ path: editingText.path, content: textContent });
    }
  };

  const navigateFolder = (path: string) => {
    setCurrentPath(path);
    setRenaming(null);
    setSearch("");
  };

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  if (editingText) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setEditingText(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <span className="text-sm font-medium truncate">{editingText.name}</span>
          <div className="flex-1" />
          <Button size="sm" onClick={handleSaveText} disabled={saveTextMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {saveTextMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        <textarea
          className="flex-1 p-4 font-mono text-sm bg-background resize-none focus:outline-none"
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder={textQuery.isLoading ? "Loading..." : ""}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <div className="flex items-center gap-2 p-3 border-b border-border bg-background/95 backdrop-blur">
          <Server className="h-4 w-4" />
          <h1 className="font-semibold">Server Files</h1>
          {status && (
            <Badge variant={status.ready ? "default" : "destructive"} className="ml-2 text-xs">
              {status.ready ? "Ready" : "Not configured"}
            </Badge>
          )}
        <div className="flex-1" />
        {status?.ready && (
          <>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-7 h-8 text-sm" />
            </div>
            <div className="flex border border-border rounded-md">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-r-none" onClick={() => setViewMode("list")}>
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7 rounded-l-none" onClick={() => setViewMode("grid")}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowNewFolder(true)}>
              <FolderPlus className="h-3.5 w-3.5 mr-1" /> Folder
            </Button>
            <Button size="sm" className="h-8" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          </>
        )}
      </div>
      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs">
          <RefreshCw className="h-3 w-3 animate-spin" /> Uploading...
        </div>
      )}

      {/* Breadcrumb */}
      {status?.ready && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border text-sm text-muted-foreground">
          <button onClick={() => navigateFolder("")} className="hover:text-foreground cursor-pointer">
            Root
          </button>
          {breadcrumbs.map((part, i) => {
            const path = breadcrumbs.slice(0, i + 1).join("/");
            return (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button onClick={() => navigateFolder(path)} className="hover:text-foreground cursor-pointer">
                  {part}
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
          <FolderPlus className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-8 w-64"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                createFolderMutation.mutate(newFolderName.trim());
              }
              if (e.key === "Escape") setShowNewFolder(false);
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!status?.ready ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Server files not configured.</p>
            <p className="text-xs mt-1">Set SERVER_FILES_ROOT environment variable.</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-border p-3 space-y-2">
                <div className="h-10 w-10 rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground select-none">
            <div className="rounded-full bg-muted/80 p-4 mb-4">
              {search ? <Search className="h-8 w-8 opacity-40" /> : <Folder className="h-8 w-8 opacity-40" />}
            </div>
            <p className="text-sm font-medium">{search ? "No files match" : "No files here"}</p>
            <p className="text-xs mt-1 text-muted-foreground/70">{search ? "Try a different search" : "Drop files or click Upload"}</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="divide-y divide-border">
            {filteredFiles.map((file) => (
              <div key={file.path} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 group">
                {file.kind === "folder" ? (
                  <Folder className="h-5 w-5 text-blue-500 shrink-0 cursor-pointer" onClick={() => navigateFolder(file.path)} />
                ) : (
                  <File className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {renaming === file.path ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && renameValue.trim()) {
                            renameMutation.mutate({
                              oldPath: file.path,
                              newPath: file.path.replace(/[^/]+$/, renameValue.trim()),
                            });
                          }
                          if (e.key === "Escape") setRenaming(null);
                        }}
                      />
                    </div>
                  ) : (
                    <p
                      className="text-sm truncate cursor-pointer"
                      onClick={() => file.kind === "folder" && navigateFolder(file.path)}
                    >
                      {file.name}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {file.kind === "file" ? formatBytes(file.size) : "—"}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {file.kind === "folder" && (
                        <DropdownMenuItem onClick={() => navigateFolder(file.path)}>Open</DropdownMenuItem>
                      )}
                      {file.kind === "file" && (
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="h-4 w-4 mr-2" /> Download
                        </DropdownMenuItem>
                      )}
                      {file.kind === "file" && /\.(txt|md|json|js|ts|tsx|jsx|css|html|yaml|yml|py|sh|csv|xml)$/i.test(file.name) && (
                        <DropdownMenuItem onClick={() => handleOpenText(file)}>
                          <Edit3 className="h-4 w-4 mr-2" /> Edit Text
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { setRenaming(file.path); setRenameValue(file.name); }}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => deleteMutation.mutate(file.path)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
            {filteredFiles.map((file) => (
              <div key={file.path} className="flex flex-col items-center p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer group transition-colors"
                onDoubleClick={() => file.kind === "folder" && navigateFolder(file.path)}>
                <div className="rounded-lg bg-muted/60 p-2.5 mb-2">
                  {file.kind === "folder" ? <Folder className="h-8 w-8 text-blue-500" /> : <File className="h-8 w-8 text-muted-foreground" />}
                </div>
                <p className="text-xs font-medium text-center w-full truncate">{file.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{file.kind === "file" ? formatBytes(file.size) : "Folder"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
