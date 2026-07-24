"use client";

import { useState, useEffect, use } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Lock, FileText, AlertCircle, HardDrive, CheckCircle2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface PublicShareData {
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  requiresPassword: boolean;
  isExpired: boolean;
  downloadCount: number;
}

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await apiClient.get<{ data: PublicShareData }>(`/public/share/${token}`);
        setData(res.data.data);
      } catch (err: any) {
        setError(err.message || "Link berbagi tidak ditemukan atau sudah kadaluarsa");
      } finally {
        setLoading(false);
      }
    }
    loadInfo();
  }, [token]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/public/share/${token}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Gagal mengunduh file");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data?.name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      if (data) {
        setData({ ...data, downloadCount: data.downloadCount + 1 });
      }
    } catch (err: any) {
      setDownloadError(err.message || "Gagal mengunduh file");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <HardDrive className="h-5 w-5 animate-pulse text-primary" /> Memuat informasi file...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-lg">Link Tidak Berlaku</CardTitle>
            <CardDescription>{error || "File tidak dapat diakses."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Link Kadaluarsa</CardTitle>
            <CardDescription>Masa berlaku link berbagi untuk file ini telah habis.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardHeader className="text-center border-b border-border/40 pb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-base truncate px-2 font-semibold">{data.name}</CardTitle>
          <CardDescription className="text-xs">
            {formatBytes(data.size)} • Diunduh {data.downloadCount}x
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {data.requiresPassword && (
            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Masukkan Password File
              </label>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          {downloadError && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              {downloadError}
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleDownload}
            disabled={downloading || (data.requiresPassword && !password)}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloading ? "Mengunduh..." : "Unduh File"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
