"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Workflow, Sparkles, ArrowRight, Play, Plus, CheckCircle, FileText, Send, MoveRight, Trash2, SlidersHorizontal, Cpu, Zap, Layers, Network, Shield, FolderOutput, Code2, Sparkle } from "lucide-react";

export default function WorkflowsPage() {
  const [rules, setRules] = useState([
    {
      id: "rule-1",
      name: "Otomasi Dokumen Faktur & Kirim ke Topic Telegram Keuangan",
      trigger: "file.uploaded",
      triggerLabel: "Setiap Ada File Dokumen Baru",
      conditionGroup: "AND",
      conditions: [
        { field: "Jenis File", operator: "Sama dengan", value: "PDF Dokumen" },
        { field: "Isi Teks Teks (OCR)", operator: "Mengandung Kata", value: "Faktur / Invoice" },
        { field: "Ukuran File", operator: "Lebih Besar Dari", value: "1 MB" },
      ],
      actions: [
        { type: "AI Ekstraksi Data", target: "Total Nilai, Nama Vendor, Tanggal Jatuh Tempo" },
        { type: "Pindahkan ke Folder", target: "/Keuangan/2026/Faktur" },
        { type: "Kirim ke Telegram Topic", target: "Supergroup Topic #Keuangan-Invoices" },
        { type: "Kirim Notifikasi Webhook", target: "https://api.perusahaan.com/hooks/accounting" },
      ],
      active: true,
    },
    {
      id: "rule-2",
      name: "Otomasi Video 4K: Transcode HLS & Subtitle AI Automatic",
      trigger: "video.uploaded",
      triggerLabel: "Setiap Ada File Video Baru",
      conditionGroup: "AND",
      conditions: [
        { field: "Kualitas Video", operator: "Sama dengan atau Lebih", value: "1080p Full HD" },
        { field: "Durasi Video", operator: "Lebih Dari", value: "2 Menit (120 detik)" },
      ],
      actions: [
        { type: "Konversi HLS Streaming", target: "Resolusi Multi-bitrate (1080p + 720p)" },
        { type: "AI Subtitle Automatic", target: "Ekstrak Bahasa -> Subtitle .vtt" },
        { type: "Buat Preview Animated GIF", target: "Preview Cuplikan 5 Detik" },
      ],
      active: true,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newTrigger, setNewTrigger] = useState("file.uploaded");
  const [newConditionGroup, setNewConditionGroup] = useState<"AND" | "OR">("AND");

  // Dynamic context options based on Trigger Event selection
  const [c1Field, setC1Field] = useState("Jenis File");
  const [c1Op, setC1Op] = useState("Sama dengan");
  const [c1Val, setC1Val] = useState("PDF Dokumen");

  const [c2Field, setC2Field] = useState("Isi Teks (OCR)");
  const [c2Op, setC2Op] = useState("Mengandung Kata");
  const [c2Val, setC2Val] = useState("Faktur / Invoice");

  const [c3Field, setC3Field] = useState("Ukuran File");
  const [c3Op, setC3Op] = useState("Lebih Besar Dari");
  const [c3Val, setC3Val] = useState("1 MB");

  // Dynamic Chained Actions
  const [act1Type, setAct1Type] = useState("AI Ekstraksi Data");
  const [act1Target, setAct1Target] = useState("Total Nilai, Nama Vendor, Tanggal Jatuh Tempo");

  const [act2Type, setAct2Type] = useState("Pindahkan ke Folder");
  const [act2Target, setAct2Target] = useState("/Keuangan/2026/Faktur");

  const [act3Type, setAct3Type] = useState("Kirim ke Telegram Topic");
  const [act3Target, setAct3Target] = useState("Supergroup Topic #Keuangan-Invoices");

  const [act4Type, setAct4Type] = useState("Kirim Notifikasi Webhook");
  const [act4Target, setAct4Target] = useState("https://api.perusahaan.com/hooks/accounting");

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Update dynamic preset options when Trigger changes
  useEffect(() => {
    if (newTrigger === "video.uploaded") {
      setC1Field("Kualitas Video");
      setC1Op("Sama dengan atau Lebih");
      setC1Val("1080p Full HD");

      setC2Field("Durasi Video");
      setC2Op("Lebih Dari");
      setC2Val("2 Menit");

      setAct1Type("Konversi HLS Streaming");
      setAct1Target("Resolusi Multi-bitrate 1080p");
      setAct2Type("AI Subtitle Automatic");
      setAct2Target("Ekstrak Bahasa -> .vtt");
      setAct3Type("Kirim ke Telegram Topic");
      setAct3Target("Supergroup Topic #Media-Videos");
    } else if (newTrigger === "image.uploaded") {
      setC1Field("Format Foto / Gambar");
      setC1Op("Sama dengan");
      setC1Val("PNG / JPG / WEBP");

      setC2Field("Deteksi AI Object / Tagging");
      setC2Op("Mengandung Tag");
      setC2Val("Pemandangan / Faktur");

      setC3Field("Ukuran File");
      setC3Op("Lebih Besar Dari");
      setC3Val("500 KB");

      setAct1Type("AI Auto-Tagging & Face Recognition");
      setAct1Target("Deteksi Objek & Wajah");
      setAct2Type("Pindahkan ke Folder");
      setAct2Target("/Galeri/Foto-Foto");
      setAct3Type("Kirim ke Telegram Topic");
      setAct3Target("Supergroup Topic #Photos-Gallery");
      setAct4Type("Kompres Gambar WebP");
      setAct4Target("Optimasi 85% Kualitas");
    } else if (newTrigger === "torrent.ingested") {
      setC1Field("Kategori Isi Torrent");
      setC1Op("Sama dengan");
      setC1Val("Software / Movies / Series");

      setC2Field("Ukuran Total Torrent");
      setC2Op("Lebih Besar Dari");
      setC2Val("2 GB");

      setC3Field("Jumlah File di Dalam Archive");
      setC3Op("Lebih Dari");
      setC3Val("1 File");

      setAct1Type("Ekstrak Archive Otomatis");
      setAct1Target("Unzip / Multi-part Extract");
      setAct2Type("Pindahkan ke Folder");
      setAct2Target("/Downloads/Torrents");
      setAct3Type("Kirim ke Telegram Topic");
      setAct3Target("Supergroup Topic #Torrent-Downloads");
      setAct4Type("Pin to IPFS Web3 Network");
      setAct4Target("Generasi Link CID Permanent");
    } else if (newTrigger === "file.uploaded") {
      setC1Field("Jenis File");
      setC1Op("Sama dengan");
      setC1Val("PDF Dokumen");

      setC2Field("Isi Teks (OCR)");
      setC2Op("Mengandung Kata");
      setC2Val("Faktur / Invoice");

      setAct1Type("AI Ekstraksi Data");
      setAct1Target("Total Nilai, Nama Vendor, Tanggal");
      setAct2Type("Pindahkan ke Folder");
      setAct2Target("/Keuangan/2026/Faktur");
      setAct3Type("Kirim ke Telegram Topic");
      setAct3Target("Supergroup Topic #Keuangan-Invoices");
    }
  }, [newTrigger]);

  const handleDeployAdvancedFlow = (e: React.FormEvent) => {
    e.preventDefault();
    const ruleName = newRuleName || (newTrigger === "video.uploaded" ? "Otomasi Transcode Video 4K & Subtitle AI" : "Otomasi Dokumen Faktur & Kirim ke Telegram Topic");
    
    const triggerLabelMap: Record<string, string> = {
      "file.uploaded": "Setiap Ada File Dokumen Baru",
      "video.uploaded": "Setiap Ada File Video Baru",
      "image.uploaded": "Setiap Ada Foto / Gambar Baru",
      "torrent.ingested": "Setiap File Torrent Selesai Diunduh",
    };

    const deployedRule = {
      id: `rule-${Date.now()}`,
      name: ruleName,
      trigger: newTrigger,
      triggerLabel: triggerLabelMap[newTrigger] || "Event Pemicu",
      conditionGroup: newConditionGroup,
      conditions: [
        { field: c1Field, operator: c1Op, value: c1Val },
        { field: c2Field, operator: c2Op, value: c2Val },
        { field: c3Field, operator: c3Op, value: c3Val },
      ],
      actions: [
        { type: act1Type, target: act1Target },
        { type: act2Type, target: act2Target },
        { type: act3Type, target: act3Target },
        { type: act4Type, target: act4Target },
      ],
      active: true,
    };

    setRules((prev) => [deployedRule, ...prev]);
    setShowModal(false);
    setStatusMsg(`BERHASIL: Otomasi Pintar "${ruleName}" Berhasil Diaktifkan!`);
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleTestRun = (ruleName: string) => {
    setStatusMsg(`SIMULASI RUNTIME: Otomasi "${ruleName}" Berhasil Diuji! Syarat Terpenuhi ➔ 4 Aksi Berantai Berhasil Dikirim ke Telegram Topic & System Webhook!`);
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">AI Workflow Automation & Rules Engine</h1>
              <p className="text-xs text-muted-foreground">Otomasi Pintar Tanpa Koding untuk Mengelola File & Telegram Topic Secara Otomatis</p>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5 shadow-md shadow-emerald-500/20 rounded-lg">
            <Plus className="h-4 w-4" /> Buat Otomasi Baru
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {statusMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in shadow-md">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* User-Friendly Multi-Node Flowchart Builder Modal */}
          {showModal && (
            <Card className="border-emerald-500/50 bg-card/95 backdrop-blur-md mb-6 shadow-2xl shadow-emerald-500/10 rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-emerald-400" /> Pembuat Otomasi Pintar Berantai (Visual Builder)
                </CardTitle>
                <CardDescription className="text-xs">
                  Atur pemicu kejadian, syarat pemeriksaan, dan aksi otomatis yang akan dilakukan secara instan.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleDeployAdvancedFlow} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Alur Otomasi</Label>
                    <Input
                      placeholder="Contoh: Otomasi Dokumen Faktur & Kirim ke Telegram Topic Keuangan"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      className="bg-background border-border/60 text-xs font-medium rounded-lg"
                    />
                  </div>

                  {/* Visual 3-Node Steps Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-background/50 border border-border/60">
                    {/* Node 1: Pemicu (Trigger) */}
                    <div className="space-y-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-blue-400 font-bold flex items-center gap-1.5">
                          <Zap className="h-4 w-4" /> 1. KAPAN OTOMASI BERJALAN?
                        </Label>
                        <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400 font-bold">PEMICU</Badge>
                      </div>
                      <select value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} className="w-full rounded-lg bg-background border border-border/60 p-2 text-xs text-foreground font-semibold">
                        <option value="file.uploaded">📄 Setiap Ada File / Dokumen Baru Upload</option>
                        <option value="video.uploaded">🎥 Setiap Ada File Video Baru Upload</option>
                        <option value="image.uploaded">🖼️ Setiap Ada Foto / Gambar Baru Upload</option>
                        <option value="torrent.ingested">📦 Setiap Torrent Selesai Diunduh</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground">Pilihan pemicu ini otomatis menyesuaikan syarat & aksi di bawahnya.</p>
                    </div>

                    {/* Node 2: Syarat Pemeriksaan (Match Conditions) */}
                    <div className="space-y-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-purple-400 font-bold flex items-center gap-1.5">
                          <Layers className="h-4 w-4" /> 2. SYARAT PEMERIKSAAN
                        </Label>
                        <select value={newConditionGroup} onChange={(e) => setNewConditionGroup(e.target.value as any)} className="bg-background border border-purple-500/30 text-[10px] text-purple-300 rounded-md px-2 py-0.5 font-bold">
                          <option value="AND">HARUS SEMUA COCOK (AND)</option>
                          <option value="OR">SALAH SATU COCOK (OR)</option>
                        </select>
                      </div>
                      
                      {/* Syarat 1 */}
                      <div className="space-y-1 bg-background/60 p-2 rounded-lg border border-border/40">
                        <span className="text-[10px] text-purple-300 font-semibold">Syarat 1</span>
                        <div className="grid grid-cols-3 gap-1">
                          <Input value={c1Field} onChange={(e) => setC1Field(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7" />
                          <Input value={c1Op} onChange={(e) => setC1Op(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7" />
                          <Input value={c1Val} onChange={(e) => setC1Val(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7 font-semibold text-purple-300" />
                        </div>
                      </div>

                      {/* Syarat 2 */}
                      <div className="space-y-1 bg-background/60 p-2 rounded-lg border border-border/40">
                        <span className="text-[10px] text-purple-300 font-semibold">Syarat 2</span>
                        <div className="grid grid-cols-3 gap-1">
                          <Input value={c2Field} onChange={(e) => setC2Field(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7" />
                          <Input value={c2Op} onChange={(e) => setC2Op(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7" />
                          <Input value={c2Val} onChange={(e) => setC2Val(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7 font-semibold text-purple-300" />
                        </div>
                      </div>
                    </div>

                    {/* Node 3: Aksi Otomatis (Chained Actions Output) */}
                    <div className="space-y-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                          <Cpu className="h-4 w-4" /> 3. AKSI OTOMATIS BERANTAI
                        </Label>
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 font-bold">AKSI</Badge>
                      </div>

                      {/* Aksi 1 */}
                      <div className="space-y-1 bg-background/60 p-2 rounded-lg border border-border/40">
                        <span className="text-[10px] text-emerald-300 font-semibold">Aksi 1: {act1Type}</span>
                        <Input value={act1Target} onChange={(e) => setAct1Target(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7 font-semibold text-emerald-300" />
                      </div>

                      {/* Aksi 2 */}
                      <div className="space-y-1 bg-background/60 p-2 rounded-lg border border-border/40">
                        <span className="text-[10px] text-emerald-300 font-semibold">Aksi 2: {act2Type}</span>
                        <Input value={act2Target} onChange={(e) => setAct2Target(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7 font-semibold text-emerald-300" />
                      </div>

                      {/* Aksi 3 */}
                      <div className="space-y-1 bg-background/60 p-2 rounded-lg border border-border/40">
                        <span className="text-[10px] text-emerald-300 font-semibold">Aksi 3: {act3Type}</span>
                        <Input value={act3Target} onChange={(e) => setAct3Target(e.target.value)} className="bg-background border-border/60 text-[10px] p-1.5 h-7 font-semibold text-emerald-300" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowModal(false)} className="text-xs">Batal</Button>
                    <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-6 shadow-md shadow-emerald-500/20 rounded-lg">
                      Aktifkan Otomasi Alur Kerja
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Active Workflows Cards */}
          {rules.map((rule) => (
            <Card key={rule.id} className="border-border/60 bg-card/60 backdrop-blur-md hover:border-border transition-all rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{rule.name}</span>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] font-semibold">Otomasi Aktif</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button onClick={() => handleTestRun(rule.name)} size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-emerald-400">
                      <Play className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Uji Jalankan Simulasi
                    </Button>
                    <Button onClick={() => handleDeleteRule(rule.id)} size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* User-Friendly Flowchart Visual Graph */}
                <div className="flex items-center gap-2 overflow-x-auto p-3.5 rounded-xl bg-background/60 border border-border/50 text-xs scrollbar-none">
                  {/* Trigger Node */}
                  <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0 flex items-center gap-1.5 shadow-sm">
                    <Zap className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-bold">Pemicu:</span> {rule.triggerLabel || rule.trigger}
                  </div>

                  <MoveRight className="h-4 w-4 text-muted-foreground shrink-0" />

                  {/* Conditions Matrix Node */}
                  <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0 flex flex-col gap-1 shadow-sm">
                    <span className="font-bold flex items-center gap-1 text-[10px] text-purple-300">
                      <Layers className="h-3 w-3" /> SYARAT PEMERIKSAAN ({rule.conditionGroup || "AND"}):
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {rule.conditions?.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-background/70 border border-purple-500/20 text-purple-300 font-semibold">
                          {c.field} {c.operator} "{c.value}"
                        </span>
                      ))}
                    </div>
                  </div>

                  <MoveRight className="h-4 w-4 text-muted-foreground shrink-0" />

                  {/* Chained Actions Node */}
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 flex flex-col gap-1 shadow-sm">
                    <span className="font-bold flex items-center gap-1 text-[10px] text-emerald-300">
                      <Cpu className="h-3 w-3" /> AKSI OTOMATIS BERANTAI:
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {rule.actions?.map((a, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-background/70 border border-emerald-500/20 text-emerald-300 font-semibold">
                          {a.type} ➔ {a.target}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
