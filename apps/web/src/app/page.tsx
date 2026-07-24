"use client";

import Link from "next/link";
import {
  Flame, HardDrive, ShieldCheck, Zap, Lock, Cpu, Command as CmdIcon,
  Copy, Layers, Activity, Gauge, ArrowRight, CheckCircle2, Server,
  Download, Upload, Eye, RefreshCw, FileText, Sparkles, UserCheck, Key, Network,
  LayoutDashboard, Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      {/* Background Gradient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
      </div>

      {/* Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">TDrive</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-medium">
            <a href="#features" className="hover:text-cyan-400 transition-colors">Capabilities</a>
            <a href="#dashboard" className="hover:text-cyan-400 transition-colors">Command Dashboard</a>
            <a href="#architecture" className="hover:text-cyan-400 transition-colors">10 Engines Radar</a>
            <a href="#benchmark" className="hover:text-cyan-400 transition-colors">Performance</a>
          </nav>

          {/* Auth CTAs */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-900 text-xs">
                Log In
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 px-4">
                Get Started Free <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-16 px-6 text-center max-w-5xl mx-auto space-y-6">
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40 px-3 py-1 text-xs rounded-full font-medium inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Telegram MTProto Enterprise Storage Platform
        </Badge>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 leading-tight">
          Unlimited Cloud Storage. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Powered by Telegram MTProto Network.
          </span>
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
          Transform Telegram storage into a high-performance cloud drive with Enterprise Command Center (`/dashboard`), Smart Auto-Clean Deduplication (Keep 1 Original File), 10 internal subsystem engines, and client-side AES-256 E2EE.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link href="/login">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-8 py-6 rounded-xl shadow-xl shadow-emerald-600/30">
              Launch TDrive Console <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Feature Pill Highlights */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Smart Auto-Clean (Keep 1 Original)
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Live Command Dashboard (`/dashboard`)
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Dual Storage (Telegram & Server)
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> AES-256-GCM E2EE Vault
          </span>
        </div>
      </section>

      {/* Enterprise Dashboard Highlight Banner */}
      <section id="dashboard" className="relative z-10 max-w-5xl mx-auto px-6 py-6">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm">Enterprise Storage & System Analytics Dashboard (`/dashboard`)</h3>
              </div>
              <p className="text-xs text-slate-400">
                10 Engines Live Radar • Dual Storage Allocation (Telegram Cloud vs Local Disk) • Real-Time Audit Stream
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40 text-xs">
              Live Telemetry Active
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Telegram Storage</span>
              <span className="text-sm font-bold text-cyan-300">Unlimited Quota</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Local Server Storage</span>
              <span className="text-sm font-bold text-purple-300">Multi-Volume Disk</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Deduplication</span>
              <span className="text-sm font-bold text-emerald-400">0-Byte Overhead</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">MTProto Core DC</span>
              <span className="text-sm font-bold text-amber-300">DC1 - DC5 Matrix</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Enterprise Product Capabilities</h2>
          <p className="text-xs text-slate-400">Next-generation features engineered specifically for Telegram MTProto Backend.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-all">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-200 text-sm">Powerful Command Dashboard (`/dashboard`)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time analytics for Telegram Cloud and Local Server Disk Storage, time-range filters (`Live`, `24h`, `7d`, `30d`), hardware CPU/RAM profiler, and live audit console.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-amber-500/40 transition-all">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-200 text-sm">Smart Auto-Clean (Keep 1 Original File)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scans exact SHA-256 hash matches and file name similarity across Telegram Cloud & Server Disk. 1-Click Smart Clean automatically preserves 1 original file and purges duplicates.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition-all">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-200 text-sm">Dynamic Storage Destination Selector</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Switch seamlessly between <strong>Telegram Private Channels</strong> or <strong>Supergroup Forum Topics</strong>. TDrive maps folders 1:1 to Forum Topic threads automatically.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-purple-500/40 transition-all">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-200 text-sm">Client-Side AES-256 E2EE Vault</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zero-knowledge encryption. File payloads are encrypted with AES-256-GCM + PBKDF2 directly in your browser before hitting Telegram servers.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-teal-500/40 transition-all">
            <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Download className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-200 text-sm">Resumable Byte-Range Streaming</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-speed HTTP 206 Partial Content downloads. Interrupted 8GB file downloads resume right where they left off without restarting.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-rose-500/40 transition-all">
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-200 text-sm">Self-Healing Storage Doctor</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              1-Click diagnostic repair engine (`/api/enterprise/doctor`). Purges orphan chunks and refreshes expired MTProto `file_reference`s automatically.
            </p>
          </div>
        </div>
      </section>

      {/* 10 Internal Subsystem Engines Architecture */}
      <section id="architecture" className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-10">
        <div className="text-center space-y-2">
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-950/40">
            System Architecture
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">Decoupled 10 Core Internal Subsystem Engines</h2>
          <p className="text-xs text-slate-400">Heavy background tasks are isolated into a dedicated worker engine pipeline.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
          {[
            { title: "1. Storage Engine", desc: "Chunk & Consistent Hashing" },
            { title: "2. Lifecycle Engine", desc: "10-Stage State Machine" },
            { title: "3. Planner Engine", desc: "Adaptive Chunk Allocator" },
            { title: "4. Worker Engine", desc: "12 Decoupled Handlers" },
            { title: "5. Policy Engine", desc: "Rules Evaluator DSL" },
            { title: "6. Queue Engine", desc: "BullMQ Priority Queue" },
            { title: "7. Telemetry Engine", desc: "RPC & Health Monitor" },
            { title: "8. Recovery Engine", desc: "Storage Doctor Repair" },
            { title: "9. AI Engine", desc: "Vision OCR & Metadata" },
            { title: "10. Security Engine", desc: "AES-256 E2EE Vault" },
          ].map((eng, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-center hover:border-cyan-500/40 transition-colors">
              <span className="font-bold text-cyan-300 block">{eng.title}</span>
              <span className="text-[11px] text-slate-500 block">{eng.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Performance Benchmarks */}
      <section id="benchmark" className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Gauge className="h-6 w-6 text-cyan-400" /> Enterprise Performance Targets
              </h3>
              <p className="text-xs text-slate-400">High-throughput benchmarks measured across Telegram Data Centers (DC1 - DC5).</p>
            </div>
            <Link href="/server/benchmark">
              <Button size="sm" variant="outline" className="border-cyan-500/40 text-cyan-300 text-xs">
                View Live Benchmark Page
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-500 block">Max Upload</span>
              <span className="text-2xl font-bold text-emerald-400">&gt; 200 MB/s</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-500 block">Max Download</span>
              <span className="text-2xl font-bold text-purple-300">&gt; 300 MB/s</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-500 block">Metadata API Latency</span>
              <span className="text-2xl font-bold text-cyan-300">&lt; 50 ms</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-500 block">Deduplication</span>
              <span className="text-2xl font-bold text-amber-300">0-Byte Overhead</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950 py-12 px-6 text-center space-y-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-extrabold text-slate-100">Ready to Upgrade Your Cloud Storage?</h2>
          <p className="text-xs text-slate-400">Join TDrive today to experience unlimited, secure, MTProto-powered cloud storage.</p>
          <div className="pt-2">
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm px-10 py-6 rounded-xl shadow-xl shadow-emerald-600/30">
                Get Started Now <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 text-xs text-slate-500 flex items-center justify-between max-w-7xl mx-auto">
          <span>&copy; {new Date().getFullYear()} TDrive Cloud Storage System. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
