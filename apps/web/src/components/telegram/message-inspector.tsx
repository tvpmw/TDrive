"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, Shield, FileText, Cpu, Hash, Layers, Calendar, RefreshCw } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export interface TelegramInspectionData {
  itemId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  storageProvider: string;
  channelName: string;
  channelId: string;
  topicId: string;
  messageId: string;
  accessHash: string;
  fileReference: string;
  fileReferenceExpiresInSec: number;
  dcId: number;
  partCount: number;
  chunks: Array<{ chunkIndex: number; telegramMessageId: string; chunkHash?: string }>;
  date: string;
}

interface MessageInspectorProps {
  data: TelegramInspectionData;
  onClose?: () => void;
}

export function MessageInspector({ data, onClose }: MessageInspectorProps) {
  return (
    <Card className="bg-slate-950 border-slate-800 text-slate-100 shadow-2xl font-mono">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-md font-semibold flex items-center gap-2 text-cyan-400">
          <Terminal className="h-5 w-5 text-emerald-400" /> MTProto Telegram Message Inspector (Dev Mode)
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40">
            DC{data.dcId} Active
          </Badge>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
              ✕
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">File Name</span>
            <span className="text-slate-200 font-semibold truncate block">{data.fileName}</span>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">File Size / Chunks</span>
            <span className="text-cyan-300 font-semibold block">
              {formatBytes(data.fileSize)} ({data.partCount} Part{data.partCount > 1 ? "s" : ""})
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">Channel ID / Name</span>
            <span className="text-amber-300 block">{data.channelName} ({data.channelId})</span>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">Topic ID / Message ID</span>
            <span className="text-emerald-300 block">Topic #{data.topicId} • Msg #{data.messageId}</span>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1 col-span-1 md:col-span-2">
            <span className="text-slate-500 block">Access Hash</span>
            <span className="text-slate-300 font-mono text-[11px] break-all">{data.accessHash}</span>
          </div>

          <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1 col-span-1 md:col-span-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 block">File Reference (Auto-Refreshed)</span>
              <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Valid ({Math.round(data.fileReferenceExpiresInSec / 3600)}h left)
              </span>
            </div>
            <span className="text-purple-300 font-mono text-[11px] break-all block">{data.fileReference}</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <span className="text-slate-400 font-semibold block flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-cyan-400" /> Multi-Chunk Manifest Breakdown
          </span>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {data.chunks.map((c) => (
              <div key={c.chunkIndex} className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between items-center text-[11px]">
                <span className="text-cyan-300">Chunk #{c.chunkIndex}</span>
                <span className="text-slate-400">Telegram Msg ID: {c.telegramMessageId}</span>
                <span className="text-slate-500 truncate max-w-[140px]">{c.chunkHash}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
