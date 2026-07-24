"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import { Settings, User, Send, CheckCircle, AlertCircle, Loader2, Shield, Database, Globe, Key, Cpu, RefreshCw, Layers } from "lucide-react";

interface MeData {
  id: string;
  email: string;
  isOperator: boolean;
  hasTelegramApiCredentials: boolean;
  hasTelegramSession: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => apiClient.get("/auth/me").then((r) => r.data.data as MeData),
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border bg-background/95 backdrop-blur">
          <Settings className="h-4 w-4" />
          <h1 className="font-semibold">Settings</h1>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading settings...</div>
          ) : (
            <Tabs defaultValue="account" className="space-y-4">
              <TabsList className="bg-card border border-border/60 p-1 rounded-xl">
                <TabsTrigger value="account">
                  <User className="h-4 w-4 mr-1" /> Account
                </TabsTrigger>
                <TabsTrigger value="telegram">
                  <Send className="h-4 w-4 mr-1" /> Telegram Basics
                </TabsTrigger>
                <TabsTrigger value="telegram-advanced">
                  <Cpu className="h-4 w-4 mr-1 text-emerald-400" /> Telegram Advanced Tuning
                </TabsTrigger>
              </TabsList>

              <TabsContent value="account">
                <AccountSettings email={me?.email} />
              </TabsContent>

              <TabsContent value="telegram" className="space-y-4">
                <TelegramSettings
                  hasApiCredentials={me?.hasTelegramApiCredentials ?? false}
                  hasSession={me?.hasTelegramSession ?? false}
                />
                <TelegramStorageModeSelector />
              </TabsContent>

              <TabsContent value="telegram-advanced">
                <TelegramAdvancedSettings />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountSettings({ email }: { email?: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: { email?: string; current_password: string; new_password?: string }) =>
      apiClient.patch("/auth/me", data),
    onSuccess: () => {
      setMessage({ type: "success", text: "Account updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setNewEmail("");
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.response?.data?.message ?? "Update failed" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Update your email or password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div className={`flex items-center gap-2 text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
            {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}
        <div className="space-y-2">
          <Label>Current Email</Label>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-email">New Email</Label>
          <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Leave blank to keep current" />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
        </div>
        <Button
          onClick={() => {
            if (!currentPassword) return;
            const data: any = { current_password: currentPassword };
            if (newEmail) data.email = newEmail;
            if (newPassword) data.new_password = newPassword;
            updateMutation.mutate(data);
          }}
          disabled={updateMutation.isPending || !currentPassword}
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Update Account
        </Button>
      </CardContent>
    </Card>
  );
}

function TelegramSettings({ hasApiCredentials, hasSession }: { hasApiCredentials: boolean; hasSession: boolean }) {
  const queryClient = useQueryClient();
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loginStep, setLoginStep] = useState<"idle" | "phone" | "code">("idle");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const credentialsMutation = useMutation({
    mutationFn: (data: { api_id: string; api_hash: string }) =>
      apiClient.put("/auth/telegram-credentials", data),
    onSuccess: () => {
      setMessage({ type: "success", text: "Telegram API credentials saved" });
      setApiId("");
      setApiHash("");
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.response?.data?.message ?? "Save failed" });
    },
  });

  const startMutation = useMutation({
    mutationFn: (data: { phone: string }) =>
      apiClient.post("/auth/telegram-login/start", data),
    onSuccess: () => {
      setMessage({ type: "success", text: "Code sent! Check your Telegram." });
      setLoginStep("code");
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.response?.data?.message ?? "Failed to send code" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (data: { code: string }) =>
      apiClient.post("/auth/telegram-login/verify", data),
    onSuccess: () => {
      setMessage({ type: "success", text: "Telegram connected!" });
      setLoginStep("idle");
      setPhone("");
      setCode("");
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.response?.data?.message ?? "Verification failed" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Telegram API Credentials
            {hasApiCredentials ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>
            Get your API ID and hash from{" "}
            <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="underline">
              my.telegram.org
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className={`flex items-center gap-2 text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
              {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="api-id">API ID</Label>
            <Input id="api-id" value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="12345678" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-hash">API Hash</Label>
            <Input id="api-hash" value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="a1b2c3d4e5f6..." />
          </div>
          <Button
            onClick={() => credentialsMutation.mutate({ api_id: apiId, api_hash: apiHash })}
            disabled={credentialsMutation.isPending || !apiId || !apiHash}
          >
            {credentialsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Save Credentials
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Telegram Session
            {hasSession ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>
            {hasSession
              ? "Session active. Re-login to refresh."
              : "Complete Telegram login to enable file storage."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasApiCredentials ? (
            <p className="text-sm text-muted-foreground">Save API credentials first.</p>
          ) : hasSession && loginStep === "idle" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-sm text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-400" /> Telegram Account Connected & Active
                </p>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">MTProto Ready</Badge>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => { setLoginStep("phone"); setMessage(null); }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-connect / Change Phone
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    apiClient.put("/auth/telegram-session", { session: "" }).then(() => {
                      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
                    });
                  }}
                >
                  Disconnect Session
                </Button>
              </div>
            </div>
          ) : loginStep === "idle" || loginStep === "phone" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter your Telegram phone number to receive a login code.</p>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+628123456789"
                />
              </div>
              <Button
                onClick={() => startMutation.mutate({ phone })}
                disabled={startMutation.isPending || !phone}
              >
                {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Send Code
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter the code sent to your Telegram.</p>
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => verifyMutation.mutate({ code })}
                  disabled={verifyMutation.isPending || !code}
                >
                  {verifyMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Verify
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setLoginStep("idle"); setCode(""); setMessage(null); }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TelegramAdvancedSettings() {
  const [chunkSize, setChunkSize] = useState("2048"); // 2 MB
  const [workerCount, setWorkerCount] = useState("8");
  const [floodWaitMultiplier, setFloodWaitMultiplier] = useState("1.5");
  const [autoArchiveDays, setAutoArchiveDays] = useState("365");

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Cpu className="h-5 w-5 text-emerald-400" /> Telegram Core Engine Low-Level Tuning
        </CardTitle>
        <CardDescription className="text-xs">
          Fine-tune MTProto worker pools, dynamic chunking buffers, and FloodWait backoff policies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Chunk Buffer Size (KB)</Label>
            <Input value={chunkSize} onChange={(e) => setChunkSize(e.target.value)} className="bg-background border-border/60 text-xs" />
            <p className="text-[10px] text-muted-foreground">Default: 2048 KB (2 MB per MTProto payload block)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Concurrent Worker Pool Count</Label>
            <Input value={workerCount} onChange={(e) => setWorkerCount(e.target.value)} className="bg-background border-border/60 text-xs" />
            <p className="text-[10px] text-muted-foreground">Default: 8 parallel MTProto connections (Max: 32)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">FloodWait Backoff Multiplier</Label>
            <Input value={floodWaitMultiplier} onChange={(e) => setFloodWaitMultiplier(e.target.value)} className="bg-background border-border/60 text-xs" />
            <p className="text-[10px] text-muted-foreground">Exponential sleep multiplier for HTTP 429 rate limit backoff</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Channel Auto-Archive Threshold (Days)</Label>
            <Input value={autoArchiveDays} onChange={(e) => setAutoArchiveDays(e.target.value)} className="bg-background border-border/60 text-xs" />
            <p className="text-[10px] text-muted-foreground">Auto-move cold files to dedicated Archive Telegram Channel</p>
          </div>
        </div>

        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
          Save Engine Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

function TelegramStorageModeSelector() {
  const queryClient = useQueryClient();
  const [storageMode, setStorageMode] = useState<"channel" | "supergroup">("supergroup");
  const [autoCreateTopic, setAutoCreateTopic] = useState(true);
  const [targetChannelName, setTargetChannelName] = useState("TDrive Private Storage");
  const [savedMsg, setSavedMsg] = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ["storage-settings"],
    queryFn: () => apiClient.get("/storage/settings").then((r) => r.data.data),
  });

  useEffect(() => {
    if (settingsData) {
      if (settingsData.storage_mode) setStorageMode(settingsData.storage_mode);
      if (settingsData.channel_name) setTargetChannelName(settingsData.channel_name);
    }
  }, [settingsData]);

  const handleSaveMode = async () => {
    try {
      await apiClient.put("/storage/settings", {
        storage_mode: storageMode,
        channel_name: targetChannelName,
      });
      queryClient.invalidateQueries({ queryKey: ["storage-settings"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 4000);
    } catch {}
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-400" /> Telegram Storage Mode & Destination Selector
        </CardTitle>
        <CardDescription className="text-xs">
          Pilih lokasi target penyimpanan media Telegram: Kanal Privat atau Telegram Supergroup berbasis Topik Forum.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {savedMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Pengaturan Mode Penyimpanan Telegram Berhasil Diperbarui!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Private Channel */}
          <div
            onClick={() => setStorageMode("channel")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              storageMode === "channel"
                ? "bg-emerald-500/10 border-emerald-500/50 text-foreground ring-1 ring-emerald-500/30"
                : "bg-background/60 border-border/60 text-muted-foreground hover:bg-accent"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                <Send className="h-4 w-4 text-emerald-400" /> 1. Telegram Private Channel
              </span>
              <input type="radio" checked={storageMode === "channel"} onChange={() => setStorageMode("channel")} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Semua file diunggah ke dalam satu Telegram Private Channel khusus milik Anda tanpa Topic Thread terpisah.
            </p>
          </div>

          {/* Option 2: Supergroup Forum Topics */}
          <div
            onClick={() => setStorageMode("supergroup")}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              storageMode === "supergroup"
                ? "bg-emerald-500/10 border-emerald-500/50 text-foreground ring-1 ring-emerald-500/30"
                : "bg-background/60 border-border/60 text-muted-foreground hover:bg-accent"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                <Layers className="h-4 w-4 text-teal-400" /> 2. Telegram Supergroup Forum Topics
              </span>
              <input type="radio" checked={storageMode === "supergroup"} onChange={() => setStorageMode("supergroup")} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tiap folder TDrive dipetakan 1:1 menjadi <b>Topic Forum Telegram</b> otomatis di dalam Supergroup Anda.
            </p>
          </div>
        </div>

        {/* Channel / Group Name & Settings */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nama Channel / Supergroup Storage Target</Label>
            <Input
              value={targetChannelName}
              onChange={(e) => setTargetChannelName(e.target.value)}
              className="bg-background border-border/60 text-xs font-medium"
            />
          </div>

          {storageMode === "supergroup" && (
            <div className="p-3.5 rounded-xl bg-background/60 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Auto-Create Telegram Forum Topic saat Buat Folder Baru</span>
                <input
                  type="checkbox"
                  checked={autoCreateTopic}
                  onChange={(e) => setAutoCreateTopic(e.target.checked)}
                  className="rounded border-border"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Sistem akan mengeksekusi perintah MTProto <code>createForumTopic</code> setiap kali Anda membuat folder baru di TDrive.
              </p>
            </div>
          )}

          <Button onClick={handleSaveMode} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-6 rounded-lg">
            Simpan Mode Penyimpanan Telegram
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


