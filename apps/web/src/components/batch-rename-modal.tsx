"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [result, setResult] = useState<{ updatedCount?: number } | null>(null);

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
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Edit3 className="h-4 w-4 text-emerald-400" /> Batch Rename Tool ({selectedItemIds.length} Selected)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-card-foreground">Find Substring / Pattern</label>
              <Input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="e.g. IMG"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-card-foreground">Replace With</label>
              <Input
                value={replaceWith}
                onChange={(e) => setReplaceWith(e.target.value)}
                placeholder="e.g. Vacation"
                className="text-xs"
              />
            </div>
          </div>

          {result ? (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Batch Rename Complete!
              </div>
              <p>
                Renamed <strong>{result.updatedCount ?? 0}</strong> files successfully.
              </p>
            </div>
          ) : (
            <Button
              onClick={handleBatchRename}
              disabled={isLoading || !pattern.trim() || selectedItemIds.length === 0}
              className="w-full text-xs font-semibold"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
