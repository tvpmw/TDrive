"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, HardDrive, Folders, FileText } from "lucide-react";

interface TreeNode {
  id: string;
  name: string;
  kind: "file" | "folder";
  size: number;
  fileCount: number;
  mimeType: string | null;
  children: TreeNode[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Squarified treemap: simple row-based layout
function squarify(
  nodes: { name: string; size: number; depth: number; color: string }[],
  x: number, y: number, w: number, h: number
): { name: string; size: number; x: number; y: number; w: number; h: number; depth: number; color: string; label: string }[] {
  if (nodes.length === 0) return [];
  const sorted = [...nodes].sort((a, b) => b.size - a.size);
  const total = sorted.reduce((s, n) => s + n.size, 0);
  const result: { name: string; size: number; x: number; y: number; w: number; h: number; depth: number; color: string; label: string }[] = [];

  let curX = x, curY = y;
  let remainingW = w, remainingH = h;
  let rowIsHorizontal = remainingW >= remainingH;
  let i = 0;
  while (i < sorted.length) {
    const rowArea = total > 0 ? sorted[i].size / total : 1 / sorted.length;
    const rowLen = rowIsHorizontal ? remainingW : remainingH;
    const rowH = rowIsHorizontal ? (remainingH * rowArea) : (remainingW * rowArea);
    const rowW = rowIsHorizontal ? remainingW : (remainingW * rowArea);

    const remaining = sorted.slice(i);
    const remainingArea = rowIsHorizontal ? remainingH * remainingW : remainingH * remainingW;
    let rowTotalSize = 0;
    let j = i;
    while (j < sorted.length) {
      const candidateArea = rowIsHorizontal ? (sorted[j].size / total) * remainingW * remainingH : (sorted[j].size / total) * remainingW * remainingH;
      // Check aspect ratio: add to row if it doesn't get too bad
      const newRowTotal = rowTotalSize + sorted[j].size;
      const rowRatio = rowIsHorizontal
        ? Math.max(rowW / (newRowTotal / total * remainingH), (newRowTotal / total * remainingH) / rowW)
        : Math.max(rowH / (newRowTotal / total * remainingW), (newRowTotal / total * remainingW) / rowH);
      if (j > i && rowRatio > 2) break; // bad aspect, stop
      rowTotalSize = newRowTotal;
      j++;
    }

    const rowItems = sorted.slice(i, j);
    const rowTotal = rowItems.reduce((s, n) => s + n.size, 0);
    const rowRatio = rowTotal / total;

    if (rowIsHorizontal) {
      const rowHeight = remainingH * rowRatio;
      let itemX = curX;
      for (const item of rowItems) {
        const itemW = (item.size / rowTotal) * remainingW;
        result.push({
          name: item.name,
          size: item.size,
          x: itemX, y: curY, w: itemW, h: rowHeight,
          depth: item.depth, color: item.color,
          label: item.size > (rowHeight * itemW * 0.15) ? item.name : "",
        });
        itemX += itemW;
      }
      curY += rowHeight;
      remainingH -= rowHeight;
    } else {
      const colWidth = remainingW * rowRatio;
      let itemY = curY;
      for (const item of rowItems) {
        const itemH = (item.size / rowTotal) * remainingH;
        result.push({
          name: item.name,
          size: item.size,
          x: curX, y: itemY, w: colWidth, h: itemH,
          depth: item.depth, color: item.color,
          label: item.size > (colWidth * itemH * 0.2) ? item.name : "",
        });
        itemY += itemH;
      }
      curX += colWidth;
      remainingW -= colWidth;
    }
    i = j;
    rowIsHorizontal = remainingW >= remainingH;
  }

  return result;
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

function colorFor(name: string, index: number): string {
  return COLORS[index % COLORS.length];
}

export function StorageTreemap() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["folders", "treemap"],
    queryFn: () => apiClient.get("/folders/treemap").then((r) => {
      const d = r.data.data;
      return { totalSize: d.totalSize as number, roots: d.roots as TreeNode[] };
    }),
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dim, setDim] = useState({ w: 600, h: 350 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = Math.max(250, Math.min(500, w * 0.55));
        setDim({ w: Math.floor(w), h: Math.floor(h) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rectangles = useMemo(() => {
    if (!data) return [];
    const flattened: { name: string; size: number; depth: number; color: string }[] = [];
    let idx = 0;
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        if (node.size > 0) {
          flattened.push({
            name: node.name,
            size: node.size,
            depth,
            color: colorFor(node.name, idx++),
          });
        }
        if (node.children.length > 0) walk(node.children, depth + 1);
      }
    };
    walk(data.roots, 0);
    return squarify(flattened, 0, 0, dim.w, dim.h);
  }, [data, dim]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dim.w * dpr;
    canvas.height = dim.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dim.w, dim.h);

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(0, 0, dim.w, dim.h);

    for (const r of rectangles) {
      // Skip tiny rects
      if (r.w < 2 || r.h < 2) continue;
      ctx.fillStyle = r.color + "80"; // 50% alpha
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      if (r.label) {
        ctx.fillStyle = "#f1f5f9";
        ctx.font = `bold ${Math.max(9, Math.min(12, r.w / 6))}px sans-serif`;
        ctx.textBaseline = "middle";
        const labelW = ctx.measureText(r.label).width;
        const labelX = r.x + r.w / 2 - labelW / 2;
        const labelY = r.y + r.h / 2 - 4;
        if (labelW < r.w - 8 && ctx.measureText(r.label).actualBoundingBoxAscent + ctx.measureText(r.label).actualBoundingBoxDescent < r.h - 4) {
          ctx.fillText(r.label, Math.max(r.x + 2, labelX), labelY);
        }
        // Size label
        const sizeStr = formatCanvasBytes(r.size);
        ctx.font = `${Math.max(8, Math.min(10, r.w / 8))}px sans-serif`;
        ctx.fillStyle = "rgba(241, 245, 249, 0.7)";
        ctx.textBaseline = "bottom";
        const sizeW = ctx.measureText(sizeStr).width;
        ctx.fillText(sizeStr, r.x + r.w / 2 - sizeW / 2, r.y + r.h - 3);
      }
    }
  }, [rectangles, dim]);

  useEffect(() => { draw(); }, [draw]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat storage treemap…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-10 text-xs text-red-400">
        Gagal memuat data storage.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {formatCanvasBytes(data.totalSize)}</span>
          <span className="flex items-center gap-1"><Folders className="h-3.5 w-3.5" /> {data.roots.reduce((s: number, n: TreeNode) => s + n.fileCount, 0)} file</span>
        </div>
        <span className="opacity-50">Squarified Treemap</span>
      </div>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full rounded-lg border border-border/40" style={{ height: dim.h }} />
      </div>
    </div>
  );
}

function formatCanvasBytes(b: number): string {
  if (!b) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
  return `${(b / Math.pow(1024, i)).toFixed(i <= 1 ? 0 : 1)} ${units[i]}`;
}