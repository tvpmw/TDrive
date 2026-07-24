"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  HardDrive, Server, Trash2, Settings, Activity,
  LogOut, Cloud, CloudOff, Shield, User, Sparkles,
  Lock, Search, FolderPlus, Upload, Command, Layers, Flame, Network, Workflow, ShieldAlert, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatBytes } from "@/lib/utils";

interface MeData {
  id: string;
  email: string;
  isOperator: boolean;
  hasTelegramApiCredentials: boolean;
  hasTelegramSession: boolean;
  driveInitialized: boolean;
}

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", badge: "Analytics" },
  { label: "Drive Explorer", icon: HardDrive, href: "/drive", badge: "Cloud" },
  { label: "Master Suite", icon: Sparkles, href: "/suite", badge: "20+ New" },
  { label: "Security Vault", icon: Lock, href: "/vault", badge: "PQC" },
  { label: "Stealth Disguise", icon: ShieldAlert, href: "/stealth", badge: "Camouflage" },
  { label: "Network Hub", icon: Network, href: "/network", badge: "Proxy" },
  { label: "AI Workflows", icon: Workflow, href: "/workflows", badge: "Auto" },
  { label: "Server Files", icon: Server, href: "/server", operatorOnly: true, badge: "NAS" },
  { label: "Telegram Ops Health", icon: Activity, href: "/server/health", operatorOnly: true, badge: "Ops" },
  { label: "CDN Benchmark", icon: Flame, href: "/server/benchmark", operatorOnly: true, badge: "MTProto" },
  { label: "Trash Bin", icon: Trash2, href: "/trash" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "API Health", icon: Activity, href: "/api-status", operatorOnly: true, badge: "Live" },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: me } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => apiClient.get("/auth/me").then((r) => r.data.data as MeData),
    staleTime: 60_000,
  });

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch { }
    router.push("/login");
  };

  const filteredItems = navItems.filter(
    (item) => !item.operatorOnly || me?.isOperator
  );

  return (
    <aside className={cn("w-64 border-r border-border/60 bg-gradient-to-b from-background via-sidebar to-background flex flex-col shrink-0 shadow-sm", className)}>
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-extrabold text-base tracking-tight text-foreground">TDrive</p>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 font-bold">
                PRO
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Telegram Drive Cloud System</p>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Main Navigation */}
      <div className="px-3 py-3">
        <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Navigation
        </p>
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              item.href === "/drive"
                ? (pathname === "/drive" || pathname.startsWith("/drive/")) && !pathname.startsWith("/drive/duplicates")
                : item.href === "/server"
                ? pathname === "/server"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-emerald-400" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-semibold border", isActive ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-muted/50 border-border/40 text-muted-foreground")}>
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      <Separator className="opacity-50" />

      {/* Storage & Telemetry Widget */}
      <StorageWidget />

      <Separator className="opacity-50" />

      {/* User Profile & Logout */}
      <div className="p-3 mt-auto space-y-2">
        {me && (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-accent/40 border border-border/40">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground">{me.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {me.isOperator && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 gap-0.5">
                    <Shield className="h-2.5 w-2.5" /> Admin
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  {me.hasTelegramSession ? (
                    <><Cloud className="h-2.5 w-2.5 text-emerald-400" /> TG Connected</>
                  ) : (
                    <><CloudOff className="h-2.5 w-2.5 text-amber-500" /> Offline</>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 h-9 rounded-lg text-xs font-medium transition-all"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </Button>
      </div>
    </aside>
  );
}

function StorageWidget() {
  const { data: storage } = useQuery({
    queryKey: ["storage-status"],
    queryFn: () => apiClient.get("/storage/status").then((r) => r.data.data),
  });

  const usedBytes = storage?.usedBytes ?? 0;
  const totalItems = storage?.totalItems ?? 0;
  const displayLimit = 100 * 1024 * 1024 * 1024; // 100 GB reference
  const percent = Math.min(100, Math.round((usedBytes / displayLimit) * 100));

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5 font-semibold">
          <HardDrive className="h-3.5 w-3.5 text-emerald-400" /> Storage Capacity
        </span>
        <span className="font-bold text-xs text-emerald-400">{formatBytes(usedBytes)}</span>
      </div>

      <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/30">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-500 rounded-full shadow-sm shadow-emerald-500/50"
          style={{ width: `${Math.max(percent, 4)}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
        <span>{totalItems} Items Synced</span>
        <span className="text-emerald-400 font-semibold">{storage?.configured ? "Telegram Cloud" : "Local Storage"}</span>
      </div>
    </div>
  );
}
