"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { Bot, Send, Loader2, Sparkles, X, Download, FolderOpen, Copy, Check } from "lucide-react";
import type { DriveItem } from "@tdrive/shared";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  items?: DriveItem[];
}

const SUGGESTIONS = [
  "cari file video terbaru",
  "foto bulan lalu",
  "dokumen kerjaan > 50 MB",
  "file PDF tag:privacy",
];

export function AiAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Halo! 👋 Saya asisten TDrive. Tanya apa saja tentang file Anda, misalnya:\n• \"cari video terbaru\"\n• \"foto bulan lalu\"\n• \"dokumen > 50 MB\"\n• \"file tag:kerjaan\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await apiClient.post<{ answer: string; items: DriveItem[] }>("/advanced/assistant", { query: q });
      setMessages((m) => [...m, { role: "assistant", text: res.data.answer, items: res.data.items }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: "assistant", text: "❌ Gagal mencari: " + (err?.message || "unknown error") }]);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const downloadItem = async (item: DriveItem) => {
    try {
      const r = await apiClient.get(`/files/${item.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-24 right-4 z-50 h-12 w-12 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
          open ? "bg-slate-800 border border-slate-600 text-slate-200" : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
        }`}
        aria-label="AI Assistant"
        title="TDrive AI Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        {!open && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-40 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[420px] rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/60 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">AI Assistant</p>
              <p className="text-[10px] text-muted-foreground">Natural language search di drive Anda</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-muted/60 border border-border/40 text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.text}
                  {m.items && m.items.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {m.items.slice(0, 6).map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg bg-background/70 border border-border/50 px-2 py-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{item.kind === "folder" ? "📂" : "📄"} {item.name}</p>
                            {item.kind === "file" && (
                              <p className="text-[9px] text-muted-foreground">
                                {item.size ? `${(item.size / 1024 / 1024).toFixed(1)} MB` : "—"} · {new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </p>
                            )}
                          </div>
                          {item.kind === "file" && (
                            <button onClick={() => downloadItem(item)} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground" title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {item.kind === "folder" && (
                            <button onClick={() => (window.location.href = `/drive/${item.id}`)} className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground" title="Buka folder">
                              <FolderOpen className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {m.items.length > 6 && (
                        <p className="text-[10px] text-muted-foreground/70">…dan {m.items.length - 6} lainnya</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/40 rounded-xl rounded-bl-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mencari…
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-3 pb-1.5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[10px] px-2 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="p-2.5 border-t border-border/60 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder='Tanya… cth: "video terbaru" atau "dokumen > 50 MB"'
              className="flex-1 h-9 rounded-lg bg-muted/50 border border-border/60 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              className="h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors flex items-center justify-center text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}