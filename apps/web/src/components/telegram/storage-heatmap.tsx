"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, FolderTree, HardDrive, ShieldCheck } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface HeatmapNode {
  accountName: string;
  channelName: string;
  topicName: string;
  capacityUsedPct: number;
  itemsCount: number;
  totalSizeBytes: number;
}

interface StorageHeatmapProps {
  nodes?: HeatmapNode[];
}

export function StorageHeatmap({ nodes = [] }: StorageHeatmapProps) {
  const defaultNodes: HeatmapNode[] = [
    {
      accountName: "Primary Account (DC2)",
      channelName: "TeleDrive Storage 1",
      topicName: "Topic Thread 1 (Documents)",
      capacityUsedPct: 88,
      itemsCount: 4200,
      totalSizeBytes: 48500000000,
    },
    {
      accountName: "Primary Account (DC2)",
      channelName: "TeleDrive Storage 1",
      topicName: "Topic Thread 2 (Media)",
      capacityUsedPct: 45,
      itemsCount: 1850,
      totalSizeBytes: 22100000000,
    },
    {
      accountName: "Backup Worker 1 (DC4)",
      channelName: "TeleDrive Storage 2",
      topicName: "Topic Thread 1 (Archives)",
      capacityUsedPct: 20,
      itemsCount: 650,
      totalSizeBytes: 9800000000,
    },
  ];

  const displayNodes = nodes.length > 0 ? nodes : defaultNodes;

  return (
    <Card className="bg-slate-950 border-slate-800 text-slate-100 shadow-xl">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-cyan-400">
          <FolderTree className="h-5 w-5" /> Telegram Storage Distribution & Heatmap
        </CardTitle>
        <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-950/40">
          Auto Channel Rotation Active
        </Badge>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {displayNodes.map((node, i) => (
          <div key={i} className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-200">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                {node.accountName} ➔ {node.channelName} ➔ <span className="text-cyan-300 font-mono">{node.topicName}</span>
              </span>
              <span className="text-xs text-slate-400">
                {node.itemsCount.toLocaleString()} items • {formatBytes(node.totalSizeBytes)}
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  node.capacityUsedPct > 80
                    ? "bg-gradient-to-r from-amber-500 to-rose-500"
                    : node.capacityUsedPct > 50
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                    : "bg-gradient-to-r from-emerald-500 to-teal-400"
                }`}
                style={{ width: `${node.capacityUsedPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Capacity Usage: <strong className="text-slate-200">{node.capacityUsedPct}%</strong></span>
              {node.capacityUsedPct > 80 ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  ⚠️ Nearing Rotation Threshold
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Optimal Target
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
