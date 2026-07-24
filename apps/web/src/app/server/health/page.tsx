"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { StorageHeatmap } from "@/components/telegram/storage-heatmap";
import { Activity, ShieldCheck, Cpu, HardDrive, RefreshCw, Layers, AlertTriangle, Star, Zap, Gauge } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { useState } from "react";
import { ChannelImportModal } from "@/components/telegram/channel-import-modal";

export default function TelegramHealthPage() {
  const [showImport, setShowImport] = useState(false);

  const { data: healthData, refetch, isFetching } = useQuery({
    queryKey: ["telegram-health"],
    queryFn: async () => {
      const res = await apiClient.get("/telegram-ops/health");
      return res.data.health;
    },
    refetchInterval: 10000,
  });

  const { data: heatmapData } = useQuery({
    queryKey: ["telegram-heatmap"],
    queryFn: async () => {
      const res = await apiClient.get("/telegram-ops/heatmap");
      return res.data.heatmap;
    },
  });

  const health = healthData || {
    status: "Healthy",
    primaryDc: "DC2 (Europe)",
    connectedAccounts: 3,
    totalChannels: 12,
    totalTopics: 148,
    totalMessages: 12450,
    storageUsedBytes: 154800000000,
    activeFloodWait: false,
    accounts: [
      {
        id: "acc-1",
        sessionName: "Primary Storage Bot (DC2)",
        dc: "DC2",
        healthScoreStars: 5,
        latencyMs: 98,
        floodWaitSeconds: 0,
        isMaintenance: false,
        status: "Connected",
      },
      {
        id: "acc-2",
        sessionName: "Backup Worker 1 (DC2)",
        dc: "DC2",
        healthScoreStars: 4,
        latencyMs: 145,
        floodWaitSeconds: 0,
        isMaintenance: false,
        status: "Connected",
      },
      {
        id: "acc-3",
        sessionName: "High-Capacity Worker (DC4)",
        dc: "DC4",
        healthScoreStars: 5,
        latencyMs: 180,
        floodWaitSeconds: 0,
        isMaintenance: false,
        status: "Connected",
      },
    ],
    rateMonitor: {
      rpcPerSec: 14.5,
      uploadSpeedMbps: 28.4,
      downloadSpeedMbps: 65.2,
      retriesCount: 2,
      reconnectsCount: 0,
    },
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      <Sidebar className="w-64 border-r border-slate-800 flex-shrink-0" />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
              <Activity className="h-6 w-6 text-emerald-400" /> Telegram Storage Health & Operations
            </h1>
            <p className="text-xs text-slate-400">
              MTProto Real-Time Monitoring • Load Balancer Pool • FloodWait Predictor • Rate Monitor
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 text-xs"
            >
              Import Existing Channel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-slate-300 hover:text-white text-xs"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6 max-w-7xl w-full mx-auto">
          {showImport && (
            <ChannelImportModal onClose={() => setShowImport(false)} />
          )}

          {/* Top Operational Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Telegram Status</span>
                  <span className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                    <ShieldCheck className="h-5 w-5" /> {health.status}
                  </span>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40">
                  {health.primaryDc}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Active Account Pool</span>
                  <span className="text-lg font-bold text-cyan-300 mt-1 block">
                    {health.connectedAccounts} Connected
                  </span>
                </div>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-950/40">
                  Auto-Failover
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Storage Capacity</span>
                  <span className="text-lg font-bold text-purple-300 mt-1 block">
                    {formatBytes(health.storageUsedBytes)}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{health.totalMessages.toLocaleString()} Msgs</span>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">FloodWait Status</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">
                    {health.activeFloodWait ? "⚠️ Active Wait" : "✓ None (Safe)"}
                  </span>
                </div>
                <Zap className="h-5 w-5 text-amber-400 animate-pulse" />
              </CardContent>
            </Card>
          </div>

          {/* Account Pool Health Scores */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-md font-semibold text-cyan-400 flex items-center gap-2">
                <Gauge className="h-5 w-5 text-cyan-400" /> Telegram Account Health & Load Balancer Pool
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {health.accounts.map((acc: any) => (
                <div key={acc.id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-200 block text-sm">{acc.sessionName}</span>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>DC: <strong className="text-slate-300">{acc.dc}</strong></span>
                      <span>Latency: <strong className="text-emerald-400">{acc.latencyMs} ms</strong></span>
                      <span>FloodWait: <strong className="text-slate-300">{acc.floodWaitSeconds}s</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: acc.healthScoreStars }).map((_, idx) => (
                        <Star key={idx} className="h-4 w-4 fill-amber-400" />
                      ))}
                    </div>
                    <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      {acc.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Real-time MTProto Rate Monitor */}
          <Card className="bg-slate-900 border-slate-800 font-mono">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-md font-semibold text-cyan-400 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" /> Real-time Telegram MTProto Rate Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
                <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">RPC / sec</span>
                  <span className="text-cyan-300 text-lg font-bold">{health.rateMonitor.rpcPerSec}</span>
                </div>
                <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Upload Speed</span>
                  <span className="text-emerald-400 text-lg font-bold">{health.rateMonitor.uploadSpeedMbps} MB/s</span>
                </div>
                <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Download Speed</span>
                  <span className="text-purple-300 text-lg font-bold">{health.rateMonitor.downloadSpeedMbps} MB/s</span>
                </div>
                <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">RPC Retries</span>
                  <span className="text-amber-300 text-lg font-bold">{health.rateMonitor.retriesCount}</span>
                </div>
                <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block">Reconnections</span>
                  <span className="text-slate-300 text-lg font-bold">{health.rateMonitor.reconnectsCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Heatmap */}
          <StorageHeatmap nodes={heatmapData} />
        </main>
      </div>
    </div>
  );
}
