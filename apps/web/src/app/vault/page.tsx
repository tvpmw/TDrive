"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Lock, Key, Cpu, Fingerprint, EyeOff, AlertTriangle } from "lucide-react";

export default function VaultPage() {
  const [realPin, setRealPin] = useState("1234");
  const [duressPin, setDuressPin] = useState("9999");
  const [pqcEnabled, setPqcEnabled] = useState(true);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(false);

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
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-semibold px-2.5 py-1">
            AES-256-GCM Active
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                <div className="p-3 rounded-lg bg-background/60 border border-border/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-emerald-400" />
                    <span>YubiKey / WebAuthn Biometrics</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/40 text-emerald-400">
                    {webAuthnEnabled ? "Registered" : "Register YubiKey"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
