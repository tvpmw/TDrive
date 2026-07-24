"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, X } from "lucide-react";

interface TextEditorDialogProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
}

export function TextEditorDialog({ fileId, fileName, onClose }: TextEditorDialogProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load content on mount
  useState(() => {
    apiClient
      .get(`/files/${fileId}/text`)
      .then((r) => {
        setContent(r.data.data.content);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message ?? "Failed to load file");
        setLoading(false);
      });
  });

  const saveMutation = useMutation({
    mutationFn: (newContent: string) =>
      apiClient.put(`/files/${fileId}/text`, { content: newContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.file(fileId) });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message ?? "Save failed");
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (content !== null) saveMutation.mutate(content);
      }
      if (e.key === "Escape") onClose();
    },
    [content, saveMutation, onClose]
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col bg-card border border-border rounded-lg shadow-lg" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{fileName}</Label>
            {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => content !== null && saveMutation.mutate(content)}
              disabled={saveMutation.isPending || content === null}
            >
              <Save className="h-3 w-3 mr-1" />
              Save (Ctrl+S)
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {error && (
          <div className="px-3 py-2 text-sm text-destructive bg-destructive/10">{error}</div>
        )}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading...
            </div>
          ) : (
            <textarea
              className="w-full h-full resize-none border-0 outline-none p-3 font-mono text-sm bg-transparent"
              value={content ?? ""}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              placeholder="Start typing..."
            />
          )}
        </div>
      </div>
    </div>
  );
}
