"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy, RefreshCw, Trash2, CheckCircle2, ShieldCheck, Send, Server,
  Loader2, AlertCircle, FileText, Sparkles, Star, Check
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

export default function DuplicateFinderPage() {
  const queryClient = useQueryClient();
  const [storageFilter, setStorageFilter] = useState<"all" | "telegram" | "server">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["duplicate-finder", storageFilter],
    queryFn: async () => {
      const res = await apiClient.get("/enterprise/duplicates", {
        params: { storage: storageFilter },
      });
      return res.data;
    },
  });

  // Single file deletion
  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      setDeletingId(id);
      await apiClient.delete(`/files/${id}`);
      return name;
    },
    onSuccess: (deletedFileName) => {
      setNotice({ type: "success", text: `✓ Duplicate file "${deletedFileName}" deleted successfully!` });
      queryClient.invalidateQueries({ queryKey: ["duplicate-finder"] });
      setTimeout(() => setNotice(null), 4000);
    },
    onError: (err: any) => {
      setNotice({ type: "error", text: err.response?.data?.message || "Failed to delete duplicate file" });
      setTimeout(() => setNotice(null), 4000);
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  // Smart Auto-Delete (Keep 1 Original)
  const smartDeleteMutation = useMutation({
    mutationFn: async (payload: { targetHash?: string; targetName?: string }) => {
      const res = await apiClient.post("/enterprise/duplicates/smart-delete", {
        ...payload,
        storageFilter,
      });
      return res.data;
    },
    onSuccess: (res) => {
      setNotice({
        type: "success",
        text: `✓ ${res.message || `Smart Cleaned! Removed ${res.deletedCount} duplicate copies and saved ${formatBytes(res.spaceSavedBytes)}!`}`,
      });
      queryClient.invalidateQueries({ queryKey: ["duplicate-finder"] });
      setTimeout(() => setNotice(null), 5000);
    },
    onError: (err: any) => {
      setNotice({ type: "error", text: err.response?.data?.message || "Smart delete operation failed" });
      setTimeout(() => setNotice(null), 4000);
    },
  });

  const exactDuplicates = data?.exactDuplicates || [];
  const nameDuplicates = data?.nameDuplicates || [];
  const totalDuplicateGroups = exactDuplicates.length + nameDuplicates.length;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 text-slate-100 font-sans">
      <header className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
            <Copy className="h-6 w-6 text-emerald-400" /> Duplicate File Finder & Cleaner
          </h1>
          <p className="text-xs text-slate-400">
            SHA-256 Hash Matching • File Name Similarity Scanner • Smart 1-Original Auto-Deduplication
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Storage Filter Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => setStorageFilter("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                storageFilter === "all" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Storage
            </button>
            <button
              onClick={() => setStorageFilter("telegram")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                storageFilter === "telegram" ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Send className="h-3 w-3" /> Telegram Cloud
            </button>
            <button
              onClick={() => setStorageFilter("server")}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                storageFilter === "server" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Server className="h-3 w-3" /> Server Storage
            </button>
          </div>

          {/* Smart Auto-Clean All Button */}
          {totalDuplicateGroups > 0 && (
            <Button
              size="sm"
              onClick={() => smartDeleteMutation.mutate({})}
              disabled={smartDeleteMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              {smartDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-300" />
              )}
              Smart Auto-Clean All (Keep 1 Original)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 text-xs flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Scan Duplicates
          </Button>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-7xl w-full mx-auto">
        {notice && (
          <div
            className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between animate-in fade-in ${
              notice.type === "success"
                ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/80 border border-rose-500/40 text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {notice.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
              {notice.text}
            </span>
          </div>
        )}

        {/* Section 1: Exact SHA-256 Hash Duplicates */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-md font-semibold text-cyan-400 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" /> 1. Exact SHA-256 Hash Duplicates ({exactDuplicates.length} Sets Found)
            </CardTitle>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40 text-xs">
              0-Byte Hash Deduplication
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {exactDuplicates.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No exact SHA-256 hash duplicate files detected. Storage deduplication is optimal.</p>
            ) : (
              exactDuplicates.map((group: any, i: number) => {
                const sortedItems = [...group.items].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const originalId = sortedItems[0]?.id;

                return (
                  <div key={i} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap justify-between items-center text-xs gap-2">
                      <span className="font-mono text-cyan-300 truncate max-w-md">SHA256: {group.hash}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-amber-300 border-amber-500/40">
                          {group.count} Duplicate Copies
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => smartDeleteMutation.mutate({ targetHash: group.hash })}
                          disabled={smartDeleteMutation.isPending}
                          className="h-6 text-[11px] border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                        >
                          <Sparkles className="h-3 w-3 mr-1 text-amber-300" /> Smart Clean (Keep 1 Original)
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {sortedItems.map((item: any) => {
                        const isOriginal = item.id === originalId;
                        return (
                          <div
                            key={item.id}
                            className={`flex justify-between items-center text-xs p-2.5 rounded border transition-all ${
                              isOriginal ? "bg-emerald-950/20 border-emerald-500/30" : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-200 font-medium">{item.name} ({formatBytes(item.size)})</span>
                                {isOriginal && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-500/50 text-emerald-300 bg-emerald-950/60 font-semibold gap-1">
                                    <Check className="h-2.5 w-2.5 text-emerald-400" /> Keep 1 Original
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <Badge variant="outline" className="text-[10px] py-0 px-1 border-slate-700 text-slate-300">
                                  {item.storageProvider}
                                </Badge>
                                <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                              </div>
                            </div>

                            {!isOriginal && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate({ id: item.id, name: item.name })}
                                disabled={deletingId === item.id}
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs"
                              >
                                {deletingId === item.id ? (
                                  <span className="flex items-center gap-1">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete Duplicate
                                  </span>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Section 2: File Name Match Duplicates */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-md font-semibold text-cyan-400 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" /> 2. File Name Match Duplicates ({nameDuplicates.length} Sets Found)
            </CardTitle>
            <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-950/40 text-xs">
              Name Similarity Scanner
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {nameDuplicates.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No file name match duplicate files detected.</p>
            ) : (
              nameDuplicates.map((group: any, i: number) => {
                const sortedItems = [...group.items].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const originalId = sortedItems[0]?.id;

                return (
                  <div key={i} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap justify-between items-center text-xs gap-2">
                      <span className="font-semibold text-amber-300 text-sm">{group.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-amber-400 border-amber-500/40">
                          {group.count} Files Found
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => smartDeleteMutation.mutate({ targetName: group.name })}
                          disabled={smartDeleteMutation.isPending}
                          className="h-6 text-[11px] border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40"
                        >
                          <Sparkles className="h-3 w-3 mr-1 text-amber-300" /> Smart Clean Group (Keep 1 Original)
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {sortedItems.map((item: any) => {
                        const isOriginal = item.id === originalId;
                        return (
                          <div
                            key={item.id}
                            className={`flex justify-between items-center text-xs p-2.5 rounded border transition-all ${
                              isOriginal ? "bg-emerald-950/20 border-emerald-500/30" : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-200 font-medium">{item.name}</span>
                                <span className="text-slate-400">({formatBytes(item.size)})</span>
                                {isOriginal && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-500/50 text-emerald-300 bg-emerald-950/60 font-semibold gap-1">
                                    <Check className="h-2.5 w-2.5 text-emerald-400" /> Keep 1 Original
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <Badge variant="outline" className="text-[10px] py-0 px-1 border-slate-700 text-cyan-300 bg-cyan-950/40">
                                  {item.storageProvider}
                                </Badge>
                                <span>Storage Channel: {item.storageChannelName || "TDrive Storage"}</span>
                                <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                              </div>
                            </div>

                            {!isOriginal && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate({ id: item.id, name: item.name })}
                                disabled={deletingId === item.id}
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs"
                              >
                                {deletingId === item.id ? (
                                  <span className="flex items-center gap-1">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Trash2 className="h-3.5 w-3.5 text-rose-400" /> Delete Duplicate
                                  </span>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
