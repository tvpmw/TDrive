"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Download, Layers, ShieldCheck, Clock, RefreshCw, Send, Radio, MessageSquare, Terminal
} from "lucide-react";
import { useState } from "react";

export default function SuitePage() {
  const [torrentUrl, setTorrentUrl] = useState("");
  const [magnetStatus, setMagnetStatus] = useState<string | null>(null);
  const [timeCapsuleHours, setTimeCapsuleHours] = useState("24");
  const [aiSummaryResult, setAiSummaryResult] = useState<string | null>(null);

  const handleTorrentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!torrentUrl) return;
    try {
      const res = await apiClient.post("/advanced/telegram/torrent-pipeline", { magnetUrl: torrentUrl });
      setMagnetStatus(`Job Launched: ${res.data.jobId} -> Streaming to ${res.data.targetChannel}`);
      setTorrentUrl("");
    } catch (err: any) {
      setMagnetStatus("Pipeline Launch Failed");
    }
  };

  const handleChannelMigrate = async () => {
    try {
      const res = await apiClient.post("/advanced/telegram/channels/auto-migrate");
      alert(`Channel Migrated! Target ID: ${res.data.targetChannelId}`);
    } catch {
      alert("Migration failed");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">TDrive Master Suite</h1>
              <p className="text-xs text-muted-foreground">Automation, Cloud Torrent, Time Capsule & Telegram Bot Hub</p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-semibold px-2.5 py-1">
            20+ Features Active
          </Badge>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="torrent" className="space-y-6">
            <TabsList className="bg-card border border-border/60 p-1 rounded-xl">
              <TabsTrigger value="torrent" className="gap-2 text-xs font-medium">
                <Download className="h-4 w-4" /> Cloud Torrent Pipeline
              </TabsTrigger>
              <TabsTrigger value="channels" className="gap-2 text-xs font-medium">
                <Layers className="h-4 w-4" /> Channel Load Balancer
              </TabsTrigger>
              <TabsTrigger value="timecapsule" className="gap-2 text-xs font-medium">
                <Clock className="h-4 w-4" /> Time Capsule Vault
              </TabsTrigger>
              <TabsTrigger value="bot" className="gap-2 text-xs font-medium">
                <Send className="h-4 w-4" /> Telegram Bot Engine
              </TabsTrigger>
            </TabsList>

            {/* Cloud Torrent Tab */}
            <TabsContent value="torrent">
              <Card className="border-border/60 bg-card/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-5 w-5 text-emerald-400" /> Torrent-to-Telegram Direct Pipeline
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Paste any Torrent Magnet Link or HTTP URL to stream contents directly to Telegram Private Channel storage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleTorrentSubmit} className="flex gap-3">
                    <Input
                      placeholder="magnet:?xt=urn:btih:... or https://file-link.com/movie.mp4"
                      value={torrentUrl}
                      onChange={(e) => setTorrentUrl(e.target.value)}
                      className="bg-background border-border/60 text-xs flex-1"
                    />
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5">
                      Ingest Stream
                    </Button>
                  </form>
                  {magnetStatus && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
                      <Radio className="h-4 w-4 animate-pulse" />
                      {magnetStatus}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Channel Load Balancer Tab */}
            <TabsContent value="channels">
              <Card className="border-border/60 bg-card/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-5 w-5 text-teal-400" /> Channel Load Balancer & Swarm
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Auto-rebalance chunk distribution and migrate items across private Telegram channels.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-background/60 border border-border/50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">TeleDrive Storage Channel #1</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Status: Active · 4,120 Messages · RAID-5 Active</p>
                    </div>
                    <Button onClick={handleChannelMigrate} variant="outline" size="sm" className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
                      Auto-Migrate Channel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Time Capsule Tab */}
            <TabsContent value="timecapsule">
              <Card className="border-border/60 bg-card/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-400" /> Time Capsule & Dead-Man Switch
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Lock encrypted files mathematically until a specific date or trigger automatic transfer to heirs upon inactivity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-background/60 border border-border/50 space-y-3">
                      <p className="text-xs font-semibold text-foreground">Lock File Duration (Hours)</p>
                      <Input
                        type="number"
                        value={timeCapsuleHours}
                        onChange={(e) => setTimeCapsuleHours(e.target.value)}
                        className="bg-background border-border/60 text-xs"
                      />
                      <Button size="sm" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium">
                        Create Time Lock
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Telegram Bot Hub Tab */}
            <TabsContent value="bot">
              <Card className="border-border/60 bg-card/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="h-5 w-5 text-indigo-400" /> Interactive Telegram Bot (@TDriveBot)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Use Telegram Bot commands, inline queries, and voice controls directly inside Telegram apps.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-background/60 border border-border/50 flex items-center justify-between text-xs">
                    <span className="font-mono text-emerald-400">@TDriveBot inline search</span>
                    <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-background/60 border border-border/50 flex items-center justify-between text-xs">
                    <span className="font-mono text-cyan-400">Telegram Voice Command Transcriber</span>
                    <Badge variant="secondary" className="text-[10px]">Enabled</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
