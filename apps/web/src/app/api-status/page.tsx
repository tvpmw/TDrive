"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { Activity, Server, Cpu, Clock, RefreshCw, CheckCircle, XCircle, Database, Zap, HardDrive, Wifi } from "lucide-react";
import { useState, useEffect } from "react";

interface HealthResponse {
  status: string;
  version: string;
  app: string;
  uptime_seconds: number;
}

export default function ApiStatusPage() {
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { data: health, isLoading, error, refetch } = useQuery({
    queryKey: ["api-health"],
    queryFn: async () => {
      const start = Date.now();
      const res = await apiClient.get("/health");
      setLastCheck(new Date());
      return { ...res.data as HealthResponse, responseTime: Date.now() - start };
    },
    refetchInterval: 15000,
  });

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Activity className="h-4 w-4" />
        <h1 className="font-semibold">API Status</h1>
        {health && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`h-2 w-2 rounded-full ${health.status === "ok" ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
            <span className="text-xs text-muted-foreground capitalize">{health.status}</span>
          </div>
        )}
        <div className="flex-1" />
        {lastCheck && (
          <span className="text-xs text-muted-foreground">
            Last check: {lastCheck.toLocaleTimeString()}
          </span>
        )}
        <Button variant="outline" size="sm" className="h-7" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" /> Checking API health...
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" /> API Unreachable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Could not connect to the API server at localhost:3001.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status hero */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`rounded-full p-2 ${health?.status === "ok" ? "bg-green-500/10" : "bg-destructive/10"}`}>
                <CheckCircle className={`h-6 w-6 ${health?.status === "ok" ? "text-green-500" : "text-destructive"}`} />
              </div>
              <div>
                <p className="font-medium">{health?.app ?? "TDrive API"}</p>
                <p className="text-sm text-muted-foreground">
                  {health?.status === "ok" ? "All systems operational" : "System experiencing issues"}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={health?.status === "ok" ? "default" : "destructive"} className="text-sm">
                    {health?.status ?? "unknown"}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Version</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-mono">{health?.version ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg">{formatUptime(health?.uptime_seconds ?? 0)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Response</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg">{health?.responseTime ?? "—"}ms</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed status section */}
            <div className="mt-6 space-y-3">
              <h2 className="text-sm font-semibold">System Components</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Database</p>
                        <p className="text-xs text-muted-foreground">PostgreSQL</p>
                      </div>
                    </div>
                    <Badge variant={health?.status === "ok" ? "default" : "destructive"} className="text-xs">
                      {health?.status === "ok" ? "Connected" : "Unknown"}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Telegram</p>
                        <p className="text-xs text-muted-foreground">MTProto</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Per-user</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Server Files</p>
                        <p className="text-xs text-muted-foreground">Local FS</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Enabled</Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Redis</p>
                        <p className="text-xs text-muted-foreground">Queue</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
