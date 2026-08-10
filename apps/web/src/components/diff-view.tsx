"use client";

import { useMemo } from "react";
import { Loader2, FileX2, GitCompare } from "lucide-react";

// ---- Minimal LCS-based line diff (no dependencies) ----
interface DiffLine {
  type: "same" | "add" | "del";
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  // DP table (LCS lengths)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "same", oldLine: i + 1, newLine: j + 1, text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "del", oldLine: i + 1, newLine: null, text: a[i] });
      i++;
    } else {
      result.push({ type: "add", oldLine: null, newLine: j + 1, text: b[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "del", oldLine: i + 1, newLine: null, text: a[i] });
    i++;
  }
  while (j < m) {
    result.push({ type: "add", oldLine: null, newLine: j + 1, text: b[j] });
    j++;
  }
  return result;
}

interface DiffViewProps {
  oldText: string;
  newText: string;
  oldLabel: string;
  newLabel: string;
}

export function DiffView({ oldText, newText, oldLabel, newLabel }: DiffViewProps) {
  const lines = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText]);
  const adds = lines.filter((l) => l.type === "add").length;
  const dels = lines.filter((l) => l.type === "del").length;

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/60 text-[11px]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-muted-foreground truncate" title={oldLabel}>{oldLabel}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="font-semibold truncate" title={newLabel}>{newLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-emerald-400 font-semibold">+{adds}</span>
          <span className="text-red-400 font-semibold">-{dels}</span>
        </div>
      </div>

      {/* Lines */}
      <div className="max-h-[38vh] overflow-auto font-mono text-[11px] leading-5">
        {lines.length === 0 && (
          <div className="px-4 py-6 text-center text-muted-foreground text-xs flex flex-col items-center gap-1.5">
            <GitCompare className="h-5 w-5 opacity-40" />
            Tidak ada perbedaan baris.
          </div>
        )}
        {lines.map((l, idx) => (
          <div
            key={idx}
            className={`flex items-stretch ${
              l.type === "add"
                ? "bg-emerald-500/10 text-emerald-300"
                : l.type === "del"
                  ? "bg-red-500/10 text-red-300"
                  : "text-muted-foreground"
            }`}
          >
            <span className="w-10 shrink-0 text-right pr-2 select-none opacity-40 border-r border-border/40 mr-2">
              {l.oldLine ?? " "}
            </span>
            <span className="w-10 shrink-0 text-right pr-2 select-none opacity-40 border-r border-border/40 mr-2">
              {l.newLine ?? " "}
            </span>
            <span className="whitespace-pre-wrap break-all pr-2">{l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}{l.text || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiffLoading() {
  return (
    <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Menghitung diff…
    </div>
  );
}

export function DiffError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-xs text-red-400 gap-1.5">
      <FileX2 className="h-5 w-5 opacity-60" />
      {message}
    </div>
  );
}
