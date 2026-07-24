"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit3, CheckCircle2, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface BatchRenameModalProps {
  selectedItemIds: string[];
  onSuccess?: () => void;
  onClose?: () => void;
}

export function BatchRenameModal({ selectedItemIds, onSuccess, onClose }: BatchRenameModalProps) {
  const [pattern, setPattern] = useState("IMG");
  const [replaceWith, setReplaceWith] = useState("Vacation");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleBatchRename = async () => {
    if (!pattern.trim() || selectedItemIds.length === 0) return;
    setIsLoading(true);
    try {
      const res = await apiClient.post("/enterprise/batch-rename", {
        itemIds: selectedItemIds,
        pattern,
        replaceWith,
      });
      setResult(res.data);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Batch rename failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-950 border-slate-800 text-slate-100 shadow-2xl">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-md font-semibold flex items-center gap-2 text-cyan-400">
          <Edit3 className="h-5 w-5 text-emerald-400" /> Batch Rename Tool ({selectedItemIds.length} Selected)
        </CardTitle>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Find Substring / Pattern</label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. IMG"
              className="bg-slate-900 border-slate-700 text-slate-100 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Replace With</label>
            <Input
              value={replaceWith}
              onChange={(e) => setReplaceWith(e.target.value)}
              placeholder="e.g. Vacation"
              className="bg-slate-900 border-slate-700 text-slate-100 text-xs"
            />
          </div>
        </div>

        {result ? (
          <div className="p-3 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Batch Rename Complete!
            </div>
            <p className="text-emerald-400">
              Renamed <strong>{result.updatedCount}</strong> files successfully.
            </p>
          </div>
        ) : (
          <Button
            onClick={handleBatchRename}
            disabled={isLoading || !pattern.trim() || selectedItemIds.length === 0}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Renaming Selected Files...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" /> Execute Batch Rename
              </span>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
