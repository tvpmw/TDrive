"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Check, Lock, Calendar, Trash2, Link, QrCode as QrCodeIcon, Download, Flame } from "lucide-react";
import type { DriveItem } from "@tdrive/shared";

interface ShareDialogProps {
  item: DriveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function ShareDialog({ item, open, onOpenChange, onUpdated }: ShareDialogProps) {
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [maxDownloads, setMaxDownloads] = useState<number | null>(null);
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(item?.shareToken ?? null);
  const [hasPassword, setHasPassword] = useState<boolean>(!!item?.hasSharePassword);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render QR code saat link tersedia
  const renderQr = useCallback(async (url: string) => {
    if (!qrCanvasRef.current || !url) return;
    try {
      await QRCode.toCanvas(qrCanvasRef.current, url, {
        width: 168,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    } catch {
      // QR gagal render — abaikan (link tetap berfungsi)
    }
  }, []);

  const publicUrl = shareToken
    ? `${window.location.origin}/s/${shareToken}`
    : "";

  useEffect(() => {
    if (item) {
      setShareToken(item.shareToken ?? null);
      setHasPassword(!!item.hasSharePassword);
      setPassword("");
      setExpiresInDays(null);
      setMaxDownloads(null);
      setSelfDestruct(false);
    }
  }, [item]);

  useEffect(() => {
    if (publicUrl) renderQr(publicUrl);
  }, [publicUrl, renderQr]);

  if (!item) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ data: DriveItem }>(`/share/${item.id}`, {
        password: password || null,
        expires_in_days: expiresInDays,
        max_downloads: maxDownloads,
        is_self_destruct: selfDestruct ? 1 : 0,
      });
      setShareToken(res.data.data.shareToken ?? null);
      setHasPassword(!!res.data.data.hasSharePassword);
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || "Failed to generate share link");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await apiClient.delete(`/share/${item.id}`);
      setShareToken(null);
      setHasPassword(false);
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || "Failed to revoke share link");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" /> Bagikan File
          </DialogTitle>
          <DialogDescription className="truncate">
            {item.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {shareToken ? (
            <div className="space-y-3">
              <Label className="text-xs font-medium">Link Berbagi Publik</Label>
              <div className="flex items-center gap-2">
                <Input value={publicUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex flex-col items-center gap-2 pt-1">
                <canvas ref={qrCanvasRef} className="rounded-lg border border-border bg-white p-1.5" aria-label="QR code link berbagi" />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <QrCodeIcon className="h-3 w-3" /> Scan untuk membuka di ponsel
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">{hasPassword ? "🔒 Berpassword" : "🌐 Publik"}</span>
                {item?.maxDownloads != null && (
                  <span className="flex items-center gap-1">
                    <Download className="h-3 w-3" /> {item.downloadCount ?? 0}/{item.maxDownloads} unduhan
                  </span>
                )}
                {item?.isSelfDestruct === 1 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <Flame className="h-3 w-3" /> Self-destruct
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={handleRevoke} className="text-destructive h-8 px-2 text-xs ml-auto">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus Link
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password-input" className="text-xs flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password Proteksi (Opsional)
                </Label>
                <Input
                  id="password-input"
                  type="password"
                  placeholder="Kosongkan jika publik"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Masa Berlaku Link
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Selamanya", val: null },
                    { label: "1 Hari", val: 1 },
                    { label: "7 Hari", val: 7 },
                    { label: "30 Hari", val: 30 },
                  ].map((opt) => (
                    <Button
                      key={opt.label}
                      type="button"
                      variant={expiresInDays === opt.val ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setExpiresInDays(opt.val)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" /> Batas Jumlah Unduhan
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Tanpa Batas", val: null },
                    { label: "5x", val: 5 },
                    { label: "10x", val: 10 },
                    { label: "25x", val: 25 },
                    { label: "100x", val: 100 },
                  ].map((opt) => (
                    <Button
                      key={opt.label}
                      type="button"
                      variant={maxDownloads === opt.val ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setMaxDownloads(opt.val)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelfDestruct(!selfDestruct)}
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all ${
                    selfDestruct
                      ? "bg-red-500/15 border-red-500/40 text-red-400"
                      : "border-border/60 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Flame className="h-4 w-4" />
                  <span>Self-Destruct setelah unduhan terakhir</span>
                </button>
              </div>

              <Button className="w-full" onClick={handleGenerate} disabled={loading}>
                <Link className="h-4 w-4 mr-2" />
                {loading ? "Memproses..." : "Buat Link Berbagi"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
