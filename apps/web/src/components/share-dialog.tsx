"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Check, Lock, Calendar, Trash2, Link } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(item?.shareToken ?? null);
  const [hasPassword, setHasPassword] = useState<boolean>(!!item?.hasSharePassword);

  useEffect(() => {
    if (item) {
      setShareToken(item.shareToken ?? null);
      setHasPassword(!!item.hasSharePassword);
      setPassword("");
      setExpiresInDays(null);
    }
  }, [item]);

  if (!item) return null;

  const publicUrl = shareToken
    ? `${window.location.origin}/s/${shareToken}`
    : "";

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ data: DriveItem }>(`/share/${item.id}`, {
        password: password || null,
        expires_in_days: expiresInDays,
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

              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>{hasPassword ? "🔒 Diberi Password" : "🌐 Tanpa Password"}</span>
                <Button variant="ghost" size="sm" onClick={handleRevoke} className="text-destructive h-8 px-2 text-xs">
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
