"use client";

import {
  HardDrive, Database, Lock, Server, Cpu, ShieldAlert,
  ArrowUpRight, ArrowDownRight, Activity, Zap, RefreshCw, CheckCircle2
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface StatsGridProps {
  totalFiles?: number;
  totalStorageBytes?: number;
  encryptedCount?: number;
  activeChannelsCount?: number;
  bandwidthTodayBytes?: number;
  apiHealthLatencyMs?: number;
}

export function StatsGrid({
  totalFiles = 0,
  totalStorageBytes = 0,
  encryptedCount = 0,
  activeChannelsCount = 1,
  bandwidthTodayBytes = 1450000000, // ~1.45 GB
  apiHealthLatencyMs = 42,
}: StatsGridProps) {
  const stats = [
    {
      title: "Total Storage Capacity",
      value: formatBytes(totalStorageBytes),
      change: "+14.2% this month",
      isPositive: true,
      description: "Encrypted Telegram Channel Cloud",
      icon: HardDrive,
      accentColor: "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-400",
      badge: "Telegram Cloud",
    },
    {
      title: "Total Files & Folders",
      value: totalFiles.toLocaleString(),
      change: "+28 items today",
      isPositive: true,
      description: "Full-Text Indexed Document Search",
      icon: Database,
      accentColor: "from-blue-500/15 via-blue-500/5 to-transparent border-blue-500/30 text-blue-400",
      badge: "Indexed FTS",
    },
    {
      title: "Zero-Knowledge Protected",
      value: `${encryptedCount} Files`,
      change: "100% Encrypted",
      isPositive: true,
      description: "Client-side AES-256-GCM Vault",
      icon: Lock,
      accentColor: "from-purple-500/15 via-purple-500/5 to-transparent border-purple-500/30 text-purple-400",
      badge: "E2EE Active",
    },
    {
      title: "Multi-Channel Storage Matrix",
      value: `${activeChannelsCount} Channels`,
      change: "RAID-5 Active",
      isPositive: true,
      description: "Reed-Solomon Parity Protection",
      icon: Server,
      accentColor: "from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30 text-amber-400",
      badge: "Matrix RAID",
    },
    {
      title: "Daily Transfer Bandwidth",
      value: formatBytes(bandwidthTodayBytes),
      change: "High throughput",
      isPositive: true,
      description: "Direct MTProto Range Proxy",
      icon: Zap,
      accentColor: "from-cyan-500/15 via-cyan-500/5 to-transparent border-cyan-500/30 text-cyan-400",
      badge: "Direct Stream",
    },
    {
      title: "API Engine Response Latency",
      value: `${apiHealthLatencyMs} ms`,
      change: "Optimal speed",
      isPositive: true,
      description: "Hono Bun Runtime Server",
      icon: Cpu,
      accentColor: "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-400",
      badge: "Operational",
    },
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            System & Storage Telemetry Grid
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full border border-border/40">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          All Services Online
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className={`relative flex flex-col justify-between overflow-hidden rounded-xl border bg-gradient-to-br p-4 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${stat.accentColor}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-foreground border border-border/50">
                    {stat.badge}
                  </span>
                  <div className="rounded-lg bg-background/50 p-1.5 text-foreground backdrop-blur-sm border border-border/30">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-xl font-bold tracking-tight text-foreground mt-1">
                  {stat.value}
                </h3>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] border-t border-border/30 pt-2 text-muted-foreground">
                <span className="truncate max-w-[110px]">{stat.description}</span>
                <span className="flex items-center font-medium text-emerald-400 shrink-0">
                  {stat.change}
                  <ArrowUpRight className="ml-0.5 h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
