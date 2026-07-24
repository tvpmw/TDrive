"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, HardDrive, Settings, ShieldAlert, Activity, Upload, Lock, FolderPlus, X, Copy, Command as CmdIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => {
        const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
        document.dispatchEvent(event);
      }}
      className="flex items-center justify-between w-full max-w-xs px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all text-xs"
    >
      <span className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span>Search commands...</span>
      </span>
      <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-300">
        <span className="text-[11px]">⌘</span>K
      </kbd>
    </button>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const actions = [
    { label: "Go to Drive Explorer", icon: HardDrive, href: "/drive", color: "text-emerald-400" },
    { label: "Duplicate File Scanner & Deduplication", icon: Copy, href: "/drive/duplicates", color: "text-emerald-400" },
    { label: "Open Telegram Ops Health", icon: Activity, href: "/server/health", color: "text-cyan-400" },
    { label: "Security Vault (AES-256 E2EE)", icon: Lock, href: "/vault", color: "text-purple-400" },
    { label: "Stealth Disguise Mode", icon: ShieldAlert, href: "/stealth", color: "text-amber-400" },
    { label: "Settings & Storage Selector", icon: Settings, href: "/settings", color: "text-slate-400" },
    { label: "Upload New File to Telegram", icon: Upload, href: "/drive?action=upload", color: "text-cyan-400" },
    { label: "Create Forum Topic Folder", icon: FolderPlus, href: "/drive?action=new-folder", color: "text-emerald-400" },
  ];

  const filtered = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  const runCommand = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-xl bg-slate-950 border-slate-800 text-slate-100 overflow-hidden shadow-2xl">
        <div className="flex items-center border-b border-slate-800 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400 mr-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search files (Ctrl+K)..."
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-xs outline-none text-slate-100 placeholder:text-slate-500"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-500 hover:text-white p-1">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No command matching "{query}".</p>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={() => runCommand(item.href)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-900 cursor-pointer text-slate-200 text-left transition-colors text-xs"
                >
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
