"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Import, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface ChannelImportModalProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export function ChannelImportModal({ onSuccess, onClose }: ChannelImportModalProps) {
  const [channelInput, setChannelInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImport = async () => {
    if (!channelInput.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiClient.post("/telegram-ops/import", {
        channelIdOrUsername: channelInput,
      });
      setResult(res.data.result);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-950 border-slate-800 text-slate-100 shadow-2xl">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-md font-semibold flex items-center gap-2 text-cyan-400">
          <Import className="h-5 w-5 text-emerald-400" /> Import Existing Telegram Channel (300k+ Files)
        </CardTitle>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4 text-sm">
        <p className="text-slate-400 text-xs leading-relaxed">
          Scan and index all document & media messages in an existing private or public Telegram channel without re-uploading bytes. TDrive automatically generates metadata records in real-time.
        </p>

        <div className="space-y-2">
          <label className="text-xs text-slate-300 font-medium">Telegram Channel Username or ID</label>
          <Input
            placeholder="e.g. @my_private_storage or -100198273645"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            className="bg-slate-900 border-slate-700 text-slate-100 text-xs font-mono"
          />
        </div>

        {result ? (
          <div className="p-3 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Channel Import Successful!
            </div>
            <p className="text-emerald-400">
              Scanned <strong>{result.messagesScanned}</strong> messages • Discovered <strong>{result.filesDiscovered}</strong> files • Created <strong>{result.itemsCreated}</strong> TDrive items.
            </p>
          </div>
        ) : (
          <Button
            onClick={handleImport}
            disabled={isLoading || !channelInput.trim()}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning Channel Messages...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Import className="h-4 w-4" /> Start Automatic Metadata Scan
              </span>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
