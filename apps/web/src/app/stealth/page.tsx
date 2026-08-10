"use client";

import { useState, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { embedDataInImageData, extractDataFromImageData } from "@/lib/steganography";
import { ShieldAlert, EyeOff, Lock, Sparkles, RefreshCw, UploadCloud, Download, FileText, CheckCircle2 } from "lucide-react";

export default function StealthPage() {
  const [secretMessage, setSecretMessage] = useState("");
  const [busy, setBusy] = useState<"encode" | "decode" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [decoded, setDecoded] = useState<string | null>(null);
  const [encodedUrl, setEncodedUrl] = useState<string | null>(null);
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null);
  const encodeFileRef = useRef<HTMLInputElement>(null);
  const decodeFileRef = useRef<HTMLInputElement>(null);

  const flash = (ok: boolean, text: string) => {
    setStatus({ ok, text });
    setTimeout(() => setStatus(null), 5000);
  };

  const loadImage = (file: File): Promise<ImageData> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        URL.revokeObjectURL(url);
        if (!ctx) return reject(new Error("Canvas tidak didukung"));
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal memuat gambar")); };
      img.src = url;
    });

  const handleEncode = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!secretMessage.trim()) return flash(false, "Isi pesan rahasia dulu sebelum encode.");

    setBusy("encode");
    setDecoded(null);
    setEncodedUrl(null);
    try {
      const imageData = await loadImage(file);
      // Pesan disimpan base64 agar aman dengan karakter unicode
      const payload = btoa(unescape(encodeURIComponent(secretMessage)));
      const embedded = embedDataInImageData(imageData, payload);
      const canvas = document.createElement("canvas");
      canvas.width = embedded.width;
      canvas.height = embedded.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak didukung");
      ctx.putImageData(embedded, 0, 0);

      const dataUrl = canvas.toDataURL("image/png");
      setEncodedUrl(dataUrl);
      setCarrierPreview(dataUrl);
      flash(true, `Pesan tersembunyi di ${file.name} (${file.size} B → ${dataUrl.length} B PNG)`);
    } catch (err: any) {
      flash(false, err?.message || "Encode gagal");
    } finally {
      setBusy(null);
    }
  };

  const handleDecode = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy("decode");
    setDecoded(null);
    try {
      const imageData = await loadImage(file);
      const payload = extractDataFromImageData(imageData);
      if (!payload) {
        flash(false, "Tidak ada pesan tersembunyi ditemukan di gambar ini.");
        return;
      }
      const message = decodeURIComponent(escape(atob(payload)));
      setDecoded(message);
      flash(true, `Pesan berhasil diekstrak dari ${file.name}`);
    } catch (err: any) {
      flash(false, err?.message || "Decode gagal — gambar bukan carrier TDrive.");
    } finally {
      setBusy(null);
    }
  };

  const downloadEncoded = () => {
    if (!encodedUrl) return;
    const a = document.createElement("a");
    a.href = encodedUrl;
    a.download = `stealth-${Date.now()}.png`;
    a.click();
  };

  const uploadToDrive = async () => {
    if (!encodedUrl) return;
    setBusy("encode");
    try {
      const blob = await (await fetch(encodedUrl)).blob();
      const formData = new FormData();
      formData.append("file", new File([blob], `stealth-${Date.now()}.png`, { type: "image/png" }));
      const res = await apiClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      flash(true, `Disimpan ke Drive: ${res.data?.data?.name ?? "stealth.png"} (terlihat sebagai PNG biasa)`);
      setEncodedUrl(null);
    } catch (err: any) {
      flash(false, err?.response?.data?.message || err?.message || "Gagal upload ke drive");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Steganography Vault (LSB Camouflage)</h1>
              <p className="text-xs text-muted-foreground">Sembunyikan pesan di dalam pixel gambar — tak terlihat mata</p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-semibold px-2.5 py-1">
            LSB Embedding Active
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-fab">
          {status && (
            <div className={`text-xs font-medium px-4 py-2.5 rounded-lg border ${status.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              {status.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Encode */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Lock className="h-4 w-4 text-emerald-400" /> Encode Pesan ke Gambar
                </CardTitle>
                <CardDescription className="text-xs">
                  Pilih gambar PNG/JPG, tulis pesan rahasia, dan sembunyikan via Least Significant Bit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pesan Rahasia</Label>
                  <textarea
                    value={secretMessage}
                    onChange={(e) => setSecretMessage(e.target.value)}
                    placeholder="Tulis pesan yang ingin disembunyikan..."
                    rows={3}
                    className="w-full rounded-md bg-background border border-border/60 p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>

                <input ref={encodeFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleEncode} />
                <Button size="sm" disabled={busy !== null} onClick={() => encodeFileRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold w-full">
                  {busy === "encode" ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Pilih Gambar & Encode
                </Button>

                {carrierPreview && (
                  <div className="space-y-2">
                    <img src={carrierPreview} alt="Hasil encode" className="w-full max-h-44 object-contain rounded-lg border border-border/50 bg-background/40" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={downloadEncoded} disabled={!encodedUrl}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Unduh PNG
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs border-emerald-500/40 text-emerald-400" onClick={uploadToDrive} disabled={busy !== null}>
                        <UploadCloud className="h-3.5 w-3.5 mr-1" /> Simpan ke Drive
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Decode */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <EyeOff className="h-4 w-4 text-purple-400" /> Decode Pesan dari Gambar
                </CardTitle>
                <CardDescription className="text-xs">
                  Unggah gambar yang dicurigai membawa pesan — ekstrak data tersembunyi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input ref={decodeFileRef} type="file" accept="image/png" className="hidden" onChange={handleDecode} />
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => decodeFileRef.current?.click()} className="w-full text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/10">
                  {busy === "decode" ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
                  {busy === "decode" ? "Menganalisis pixel..." : "Pilih Gambar & Decode"}
                </Button>

                {decoded !== null && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs space-y-1.5">
                    <p className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Pesan Ditemukan
                    </p>
                    <p className="text-foreground break-words font-mono bg-background/40 rounded p-2">{decoded || "(pesan kosong)"}</p>
                  </div>
                )}

                <div className="p-3 rounded-lg border border-border/50 bg-background/50 text-[11px] text-muted-foreground space-y-1 font-mono">
                  <p>LSB Embedding: bit LSB tiap channel RGBA dimodifikasi ±1</p>
                  <p>Kapasitas: ~1 bit/pixel · Deteksi mata: tidak terlihat</p>
                  <p>Header PNG: tetap valid — lolos pemeriksaan MIME</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
