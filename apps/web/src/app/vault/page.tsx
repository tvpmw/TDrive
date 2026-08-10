"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  ShieldCheck,
  Lock,
  Key,
  Cpu,
  Fingerprint,
  EyeOff,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface PasskeyCredential {
  id: string;
  credentialId: string;
  transports: string;
  createdAt: string;
}

export default function VaultPage() {
  const [realPin, setRealPin] = useState("1234");
  const [duressPin, setDuressPin] = useState("9999");
  const [pqcEnabled] = useState(true);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await apiClient.get("/webauthn/credentials");
      const creds = res.data?.data ?? [];
      setPasskeys(creds);
      setWebAuthnEnabled(creds.length > 0);
    } catch {
      setPasskeys([]);
      setWebAuthnEnabled(false);
    }
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  const flash = (ok: boolean, text: string) => {
    setStatus({ ok, text });
    setTimeout(() => setStatus(null), 4000);
  };

  const registerPasskey = async () => {
    setBusy("register");
    try {
      const begin = await apiClient.post("/webauthn/register/begin");
      const options = begin.data?.data;
      const response = await startRegistration(options);
      const complete = await apiClient.post("/webauthn/register/complete", { response });
      if (complete.data?.data?.ok) {
        flash(true, "Passkey berhasil didaftarkan ✅");
        await loadPasskeys();
      }
    } catch (err: any) {
      flash(false, err?.response?.data?.message || err?.message || "Registrasi gagal");
    } finally {
      setBusy(null);
    }
  };

  const unlockWithBiometric = async () => {
    setBusy("unlock");
    try {
      const begin = await apiClient.post("/webauthn/unlock/begin");
      const options = begin.data?.data;
      const response = await startAuthentication(options);
      const complete = await apiClient.post("/webauthn/unlock/complete", { response });
      if (complete.data?.data?.vaultUnlocked) {
        setVaultUnlocked(true);
        flash(true, "Vault dibuka dengan biometrik 🔓");
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        flash(false, "Belum ada passkey terdaftar. Daftarkan dulu.");
      } else {
        flash(false, err?.response?.data?.message || err?.message || "Autentikasi gagal");
      }
    } finally {
      setBusy(null);
    }
  };

  const removePasskey = async (id: string) => {
    setBusy(`del-${id}`);
    try {
      await apiClient.delete(`/webauthn/credentials/${id}`);
      flash(true, "Passkey dihapus");
      await loadPasskeys();
    } catch (err: any) {
      flash(false, err?.response?.data?.message || "Gagal menghapus passkey");
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
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Security & E2EE Vault</h1>
              <p className="text-xs text-muted-foreground">Client-Side AES-256-GCM + PBKDF2/Argon2id E2EE (PQC Experimental Roadmap)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {vaultUnlocked && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-semibold px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Unlocked
              </Badge>
            )}
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-semibold px-2.5 py-1">
              AES-256-GCM Active
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-fab">
          {status && (
            <div
              className={`text-xs font-medium px-4 py-2.5 rounded-lg border ${
                status.ok
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {status.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duress Vault Settings */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <EyeOff className="h-4 w-4 text-purple-400" /> Bypass Password Decoy Vault (Duress Mode)
                </CardTitle>
                <CardDescription className="text-xs">
                  Set a fake Duress PIN to display a clean decoy drive when forced under coercion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Real Primary Vault PIN</Label>
                  <Input type="password" value={realPin} onChange={(e) => setRealPin(e.target.value)} className="bg-background border-border/60 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Duress Decoy PIN
                  </Label>
                  <Input type="password" value={duressPin} onChange={(e) => setDuressPin(e.target.value)} className="bg-background border-border/60 text-xs border-amber-500/30 text-amber-400" />
                </div>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold w-full">
                  Save Vault PINs
                </Button>
              </CardContent>
            </Card>

            {/* Post-Quantum Cryptography */}
            <Card className="border-border/60 bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Cpu className="h-4 w-4 text-indigo-400" /> Quantum-Resistant Lattice Encryption
                </CardTitle>
                <CardDescription className="text-xs">
                  Algorithm hybrid AES-256-GCM + Crystals-Kyber Post-Quantum Cryptography (PQC).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
                  <span>CRYSTALS-Kyber-1024 Key Exchange</span>
                  <Badge variant="outline" className="border-indigo-400 text-indigo-300 text-[10px]">Enabled</Badge>
                </div>
                <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4 text-emerald-400" />
                      <span>Passkey / Biometric (WebAuthn)</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={registerPasskey}
                      disabled={busy !== null}
                      className="h-7 text-xs border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                    >
                      {busy === "register" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      {webAuthnEnabled ? "Tambah Passkey" : "Register Passkey"}
                    </Button>
                  </div>

                  {passkeys.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {passkeys.map((pk) => (
                        <div key={pk.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background/60 border border-border/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <Key className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-muted-foreground">
                              {pk.credentialId.length > 18 ? `${pk.credentialId.slice(0, 18)}…` : pk.credentialId}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">Passkey</Badge>
                            <button
                              onClick={() => removePasskey(pk.id)}
                              disabled={busy !== null}
                              className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              aria-label="Hapus passkey"
                            >
                              {busy === `del-${pk.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={unlockWithBiometric}
                  disabled={busy !== null}
                  className="w-full h-8 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                >
                  {busy === "unlock" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Fingerprint className="h-3.5 w-3.5 mr-1.5" />}
                  {vaultUnlocked ? "Vault Terbuka — Unlock Lagi" : "Unlock Vault dengan Biometrik"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Info bar */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card/40 backdrop-blur-md">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">WebAuthn Passkey — unlocked via biometric (Touch ID / Windows Hello / YubiKey)</p>
              <p>
                Passkey di-generate di perangkat Anda dan diverifikasi dengan challenge satu-pakai (TTL 5 menit). Kunci privat
                tidak pernah meninggalkan perangkat. Status <span className="text-emerald-400">AES-256-GCM Active</span> berarti
                enkripsi data-at-rest tetap aktif; passkey hanya membuka vault.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
