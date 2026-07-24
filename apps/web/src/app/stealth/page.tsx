"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, EyeOff, Music, FileText, Lock, Sparkles, RefreshCw } from "lucide-react";

export default function StealthPage() {
  const [stealthKey, setStealthKey] = useState("chameleon-secret-key-99");
  const [targetFile, setTargetFile] = useState("Confidential_Report.pdf");
  const [disguisedType, setDisguisedType] = useState("audio/mp3");

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
              <h1 className="text-base font-bold tracking-tight">Encrypted File Camouflage (Chameleon Stealth Mode)</h1>
              <p className="text-xs text-muted-foreground">Header Disguise, Extension Camouflage & Stealth Encryption</p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-semibold px-2.5 py-1">
            Stealth Camouflage Active
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Camouflage Config */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <EyeOff className="h-4 w-4 text-emerald-400" /> Chameleon File Disguise Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Disguise sensitive files as normal MP3 audio or JPEG wallpapers on Telegram storage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Target Sensitive File Name</Label>
                  <Input value={targetFile} onChange={(e) => setTargetFile(e.target.value)} className="bg-background border-border/60 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Stealth Decryption Key</Label>
                  <Input type="password" value={stealthKey} onChange={(e) => setStealthKey(e.target.value)} className="bg-background border-border/60 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Disguise Profile Target</Label>
                  <select value={disguisedType} onChange={(e) => setDisguisedType(e.target.value)} className="w-full rounded-md bg-background border border-border/60 p-2 text-xs text-emerald-300">
                    <option value="audio/mp3">🎵 MP3 Audio Song Cover (ID3 Header)</option>
                    <option value="image/jpeg">🖼️ JPEG High-Res Wallpaper (EXIF Header)</option>
                    <option value="video/mp4">🎥 Short MP4 Trailer Cover</option>
                  </select>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold w-full">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Disguise & Upload to Telegram
                </Button>
              </CardContent>
            </Card>

            {/* Live Camouflage Inspector */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Music className="h-4 w-4 text-emerald-400" /> Telegram Storage Public Inspector
                </CardTitle>
                <CardDescription className="text-xs">
                  How Telegram or third-party inspects your disguised file on storage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-lg border border-border/50 bg-background/50 space-y-1.5 font-mono">
                  <p className="text-muted-foreground">Original File: <span className="text-foreground font-semibold">{targetFile}</span></p>
                  <p className="text-muted-foreground">Telegram Stored Name: <span className="text-emerald-400 font-semibold">Track_01_Lofi_Beat.mp3</span></p>
                  <p className="text-muted-foreground">Inspected MIME: <span className="text-emerald-400 font-semibold">audio/mpeg (ID3v2)</span></p>
                  <p className="text-muted-foreground">Header Signature: <span className="text-purple-400 font-semibold">49 44 33 03 00 00 (ID3 Header)</span></p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  🔒 On Telegram storage, this file appears as a harmless MP3 audio track. Only TDrive Stealth Key can decrypt the original binary data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
