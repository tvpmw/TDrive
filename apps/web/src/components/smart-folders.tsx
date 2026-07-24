"use client";

import { HardDrive, Flame, Clock, Archive, Sparkles, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SmartFoldersProps {
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
}

export function SmartFolders({ activeFilter = "all", onSelectFilter }: SmartFoldersProps) {
  const filters = [
    { id: "all", label: "All Items", icon: HardDrive },
    { id: "large", label: "Large Files (>500MB)", icon: Flame, badge: "Heavy" },
    { id: "recent", label: "Recent Media", icon: Clock },
    { id: "archive", label: "Cold Archive (>180d)", icon: Archive, badge: "Cold" },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {filters.map((f) => {
        const Icon = f.icon;
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onSelectFilter && onSelectFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {f.label}
            {f.badge && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400">
                {f.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
