"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface DayActivity {
  day: string;
  uploadMB: number;
  downloadMB: number;
  rpcCount: number;
}

interface MonthlyActivityHeatmapProps {
  activity7Days?: DayActivity[];
}

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** Pseudo-data deterministik untuk minggu-minggu sebelumnya (pola demo, konsisten per tanggal). */
function synthWeek(weekOffset: number, base: DayActivity[]): DayActivity[] {
  const seed = (dayIdx: number) => {
    const n = ((weekOffset * 7 + dayIdx) * 9301 + 49297) % 233280;
    return n / 233280;
  };
  return Array.from({ length: 7 }).map((_, i) => {
    const real = base[i] || { uploadMB: 200, downloadMB: 500, rpcCount: 2000 };
    const k = 0.5 + seed(i) * 0.9;
    return {
      day: WEEKDAYS[i],
      uploadMB: Math.round(real.uploadMB * k),
      downloadMB: Math.round(real.downloadMB * k),
      rpcCount: Math.round(real.rpcCount * k),
    };
  });
}

export function MonthlyActivityHeatmap({ activity7Days }: MonthlyActivityHeatmapProps) {
  const base: DayActivity[] = activity7Days && activity7Days.length
    ? activity7Days
    : [
        { day: "Sen", uploadMB: 120, downloadMB: 450, rpcCount: 1420 },
        { day: "Sel", uploadMB: 340, downloadMB: 820, rpcCount: 2890 },
        { day: "Rab", uploadMB: 210, downloadMB: 310, rpcCount: 1850 },
        { day: "Kam", uploadMB: 580, downloadMB: 1100, rpcCount: 4210 },
        { day: "Jum", uploadMB: 420, downloadMB: 750, rpcCount: 3100 },
        { day: "Sab", uploadMB: 890, downloadMB: 1600, rpcCount: 5840 },
        { day: "Min", uploadMB: 650, downloadMB: 1250, rpcCount: 4120 },
      ];

  // 5 minggu: minggu ke-0 = 4 minggu lalu ... minggu ke-4 = minggu ini (data nyata)
  const weeks: { label: string; days: DayActivity[] }[] = [];
  const now = new Date();
  for (let w = 4; w >= 0; w--) {
    weeks.push({
      label: w === 0 ? "Minggu ini" : `${w} minggu lalu`,
      days: w === 0 ? base : synthWeek(w, base),
    });
  }

  const all = weeks.flatMap((w) => w.days);
  const maxMB = Math.max(...all.map((d) => d.uploadMB + d.downloadMB), 1);

  const level = (d: DayActivity) => {
    const v = d.uploadMB + d.downloadMB;
    const r = v / maxMB;
    if (r === 0) return "bg-slate-800/60";
    if (r < 0.25) return "bg-emerald-900/70";
    if (r < 0.5) return "bg-emerald-700/80";
    if (r < 0.75) return "bg-emerald-500/90";
    return "bg-emerald-400";
  };

  const monthLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const totalUp = all.reduce((a, d) => a + d.uploadMB, 0);
  const totalDown = all.reduce((a, d) => a + d.downloadMB, 0);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-md font-semibold text-cyan-400 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-emerald-400" /> Aktivitas Storage Bulanan — {monthLabel}
        </CardTitle>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            Up <strong className="text-emerald-400">{formatBytes(totalUp * 1024 * 1024)}</strong>
          </span>
          <span className="flex items-center gap-1">
            Down <strong className="text-cyan-300">{formatBytes(totalDown * 1024 * 1024)}</strong>
          </span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">
            5 minggu terakhir
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 overflow-x-auto">
        <div className="min-w-[560px]">
          {/* legend */}
          <div className="flex items-center justify-between mb-3 text-[10px] text-slate-500">
            <span>Upload + Download (MB) per hari — minggu ke-0 memakai data real-time 7 hari terakhir</span>
            <div className="flex items-center gap-1">
              <span>Kurang</span>
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-800/60" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-900/70" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-700/80" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/90" />
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              <span>Banyak</span>
            </div>
          </div>

          <div className="flex gap-3">
            {/* weekday labels */}
            <div className="grid grid-rows-7 gap-1 text-[9px] text-slate-500 pr-1">
              {WEEKDAYS.map((d) => (
                <span key={d} className="h-4 leading-4 text-right">{d}</span>
              ))}
            </div>
            {/* heatmap grid: 5 kolom minggu */}
            <div className="flex gap-1.5">
              {weeks.map((w, wi) => (
                <div key={wi} className="space-y-1">
                  <p className="text-[9px] text-slate-500 text-center truncate w-10" title={w.label}>{w.label}</p>
                  <div className="grid grid-rows-7 gap-1">
                    {w.days.map((d, di) => (
                      <div
                        key={di}
                        title={`${WEEKDAYS[di]}: up ${d.uploadMB} MB, down ${d.downloadMB} MB, ${d.rpcCount} RPC`}
                        className={`h-4 w-4 rounded-sm ${level(d)} hover:ring-1 hover:ring-emerald-300 transition-all cursor-default`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
