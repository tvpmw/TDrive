"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Flame, Lock, ShieldCheck, Zap, ArrowRight, Eye, EyeOff, Loader2,
  AlertCircle, CheckCircle2, HardDrive, Sparkles, Send, Key
} from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");

  const { data: regSettings } = useQuery({
    queryKey: ["registration-settings"],
    queryFn: () => apiClient.get("/auth/registration-settings").then((r) => r.data.data),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: () => apiClient.post("/auth/login", { email, password }).then((r) => r.data.data),
    onSuccess: () => router.push("/drive"),
  });

  const registerMutation = useMutation({
    mutationFn: () => apiClient.post("/auth/register", { email, password }).then((r) => r.data.data),
    onSuccess: () => router.push("/drive"),
  });

  const showRegister = regSettings?.registrationEnabled !== false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Background Gradient Glow Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px]" />
      </div>

      {/* Main Dual-Panel Container */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">

        {/* Left Side: Brand Showcase & Enterprise Features */}
        <div className="lg:col-span-5 p-8 sm:p-10 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between space-y-8">
          <div className="space-y-6">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white transition-transform group-hover:scale-105">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-white block">TDrive</span>
                <span className="text-[11px] text-slate-400 block font-medium">Telegram Cloud Platform</span>
              </div>
            </Link>

            <div className="space-y-2 pt-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                Enterprise Cloud Storage. <br />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Unlimited & Encrypted.
                </span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Securely store, stream, and manage files powered by Telegram MTProto backend infrastructure.
              </p>
            </div>

            {/* Feature Highlights List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </div>
                <span>Unlimited Telegram MTProto Storage</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="h-6 w-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <span>Client-Side AES-256-GCM E2EE Vault</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="h-6 w-6 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span>Smart Auto-Deduplication (Keep 1 Original)</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="h-6 w-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <span>Command Dashboard (`/dashboard`)</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> MTProto DC2 Active
            </span>
            <span className="font-mono">v1.0.0 Stable</span>
          </div>
        </div>

        {/* Right Side: Authentication Form Console */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center space-y-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full space-y-6">

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-100">
                  {tab === "login" ? "Welcome Back" : "Create TDrive Account"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {tab === "login" ? "Sign in to access your cloud drive console" : "Register your credentials to start storing files"}
                </p>
              </div>

              <TabsList className="bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <TabsTrigger
                  value="login"
                  className="text-xs px-3 py-1.5 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"
                >
                  Sign In
                </TabsTrigger>
                {showRegister && (
                  <TabsTrigger
                    value="register"
                    className="text-xs px-3 py-1.5 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"
                  >
                    Register
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Sign In Form */}
            <TabsContent value="login" className="space-y-4 m-0 focus-visible:outline-none">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loginMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-slate-300 font-medium">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs h-10 focus:border-emerald-500/60 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-xs text-slate-300 font-medium">Password</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs h-10 pr-10 focus:border-emerald-500/60 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {loginMutation.isError && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>Authentication failed. Please verify your email & password.</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs h-10 rounded-xl shadow-lg shadow-emerald-600/25 transition-all mt-2"
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Sign In to Console <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Registration Form */}
            {showRegister && (
              <TabsContent value="register" className="space-y-4 m-0 focus-visible:outline-none">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    registerMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-xs text-slate-300 font-medium">Email Address</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs h-10 focus:border-emerald-500/60 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-xs text-slate-300 font-medium">Create Password</Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 text-xs h-10 pr-10 focus:border-emerald-500/60 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {registerMutation.isError && (
                    <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>Registration failed. This email may already be registered.</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs h-10 rounded-xl shadow-lg shadow-emerald-600/25 transition-all mt-2"
                  >
                    {registerMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Creating Account...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Register & Launch Console <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            )}
          </Tabs>

          <div className="pt-4 text-center">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ← Return to Landing Page
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
