"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Network, Radio, Zap, Globe, Server, Shield, ArrowUpRight } from "lucide-react";

export default function NetworkPage() {
  const [proxyList, setProxyList] = useState("socks5://127.0.0.1:1080\nmtproto://proxy.example.com:443");
  const [daySpeedLimit, setDaySpeedLimit] = useState("0"); // unlimited
  const [nightSpeedLimit, setNightSpeedLimit] = useState("0");

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card/40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Network & Tunneling Hub</h1>
              <p className="text-xs text-muted-foreground">MTProto Proxy Swarm, Dynamic IP Rotation & Smart QoS</p>
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 font-semibold px-2.5 py-1">
            Proxy Swarm Active
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Custom MTProto Proxy Swarm */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Radio className="h-4 w-4 text-cyan-400" /> Custom MTProto Proxy Swarm & Dynamic IP Rotation
                </CardTitle>
                <CardDescription className="text-xs">
                  Rotate IP proxy automatically per-chunk upload to bypass ISP throttling & maximize speed up to 1 Gbps.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Proxy List (SOCKS5 / MTProxy - one per line)</Label>
                  <textarea
                    rows={4}
                    value={proxyList}
                    onChange={(e) => setProxyList(e.target.value)}
                    className="w-full rounded-md bg-background border border-border/60 p-2.5 text-xs font-mono text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold w-full">
                  Save & Test Proxy Swarm
                </Button>
              </CardContent>
            </Card>

            {/* Smart QoS & Traffic Shaper */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Zap className="h-4 w-4 text-amber-400" /> Bandwidth Traffic Shaper & Smart QoS
                </CardTitle>
                <CardDescription className="text-xs">
                  Separate speed limit allocations for working hours vs night hours & HLS streaming.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Day Limit (MB/s)</Label>
                    <Input value={daySpeedLimit} onChange={(e) => setDaySpeedLimit(e.target.value)} className="bg-background border-border/60 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Night Limit (MB/s)</Label>
                    <Input value={nightSpeedLimit} onChange={(e) => setNightSpeedLimit(e.target.value)} className="bg-background border-border/60 text-xs" />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4" /> Global Edge CDN Caching Node (Cloudflare Edge)
                  </span>
                  <Badge variant="outline" className="border-emerald-400 text-emerald-400 text-[10px]">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
