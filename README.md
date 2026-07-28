# 🚀 TDrive - High-Performance Telegram Cloud Storage Engine

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/tvpmw/TDrive)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/tvpmw/TDrive)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![Hono API](https://img.shields.io/badge/Hono.js-Node.js-orange)](https://hono.dev/)
[![Telegram MTProto](https://img.shields.io/badge/Telegram-MTProto-blue?logo=telegram)](https://core.telegram.org/mtproto)

**TDrive** adalah platform **Enterprise Cloud Storage Engine** berperforma tinggi yang mengalirkan data secara langsung ke jaringan **Telegram MTProto Storage** sebagai infrastruktur cloud tak terbatas. TDrive menggabungkan antarmuka *User Experience* modern (setara Google Drive / Dropbox) dengan **10 Internal Subsystem Engines**, **Enterprise Command Dashboard**, **Smart Auto-Clean Deduplication**, dan **Client-Side AES-256-GCM E2EE Vault**.

---

## 📚 Navigation & Documentation Index

- 📋 **Master Feature Catalog:** [TDRIVE_SEMUA_FITUR_DAN_KEMAMPUAN.md](TDRIVE_SEMUA_FITUR_DAN_KEMAMPUAN.md)
- 🏛️ **Technical Architecture Specification:** [ARCHITECTURE.md](ARCHITECTURE.md)

---

## ⚡ Key Highlights & Core Capabilities

- ♾️ **Unlimited Storage Capacity:** Menggunakan cloud Telegram MTProto sebagai backend penyimpanan tak terbatas secara gratis & aman.
- 🤖 **Telegram Bot Integration (`/settings`):** Bot Telegram pribadi via @BotFather — cari file, upload, download, share, cek status langsung dari chat Telegram. Dilindungi *Allowed IDs* authorization.
- 📊 **Enterprise Command Dashboard (`/dashboard`):** Monitoring analitik real-time dengan filter waktu (*Live, 24h, 7d, 30d*), radar 10 engine, heatmap kanal Telegram, dan profiler hardware OS (Windows / Linux).
- 🧹 **Smart Auto-Clean Deduplication (`/drive/duplicates`):** Pemindai 1-klik yang otomatis menyisakan 1 berkas asli (*Keep 1 Original File*) dan membersihkan salinan duplikat secara masal.
- 🔐 **Client-Side AES-256-GCM E2EE Vault (`/vault`):** Enkripsi *zero-knowledge* langsung di browser sebelum payload dikirim ke server Telegram.
- 📂 **Dynamic Storage Destination Selector:** Pilih alokasi penyimpanan antara *Telegram Private Channel* atau pemetaan 1:1 *Supergroup Forum Topics*.
- ⌨️ **Global Command Palette (`Ctrl+K`):** Pencarian dan peluncuran perintah instan dari halaman manapun.
- ⚡ **Resumable Byte-Range HTTP Streaming:** Pengunduhan file besar berbasis HTTP 206 Partial Content.
- 🏥 **Self-Healing Storage Doctor (`/api/enterprise/doctor`):** Pemulihan otomatis 1-klik untuk *orphan chunks* dan penyegaran `file_reference` kedaluwarsa.
- 🚀 **One-Click Deploy Scripts:** Otomasi setup untuk Linux (`setup-linux.sh`) dan Windows (`setup-windows.ps1`) dengan PM2 + nginx reverse proxy.

---

## 🏛️ System Architecture & 10 Core Internal Engines

TDrive beroperasi menggunakan arsitektur Decoupled Native Monorepo (*Next.js 16 App Router + Hono API + PostgreSQL 16 + Redis/BullMQ Queue*):

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                        Frontend Layer (Next.js 16)                       │
 │  - Enterprise Command Dashboard  - Global Command Palette (Ctrl+K)       │
 │  - Drive Explorer UI             - Telegram Ops Dashboard & Storage Heatmap│
 │  - Smart Auto-Clean Deduplicator - Security Vault & Stealth Disguise UI  │
 │  - Telegram Bot Settings & Allowed IDs Management                       │
 └────────────────────────────────────┬─────────────────────────────────────┘
                                      │ REST API / Server-Sent Events (SSE)
 ┌────────────────────────────────────▼─────────────────────────────────────┐
 │                         Backend Layer (Hono Node.js)                     │
 │  - Dashboard Telemetry API       - Storage Lifecycle Engine              │
 │  - Smart Deduplication Engine    - Security & AES-256 E2EE Vault        │
 │  - Telegram Bot Manager (grammy) - Bot Command Handler (12 commands)    │
```

### ⚙️ 10 Core Internal Engines:
1. **Storage Engine:** Consistent hashing & chunk allocator (*Private Channel* vs *Forum Topics*).
2. **Lifecycle Engine:** 10-stage file state machine (`CREATED` ➔ `UPLOADING` ➔ `VERIFYING` ➔ `READY` ➔ `PURGED`).
3. **Planner Engine:** Dynamic chunk size planner (512KB - 16MB) & account load balancer.
4. **Worker Engine:** Pipeline 12 background workers (*UploadWorker, DownloadWorker, PreviewWorker, IntegrityWorker, etc.*).
5. **Policy Engine (Rules Evaluator DSL):** Rules evaluator (`IF size > 4GB THEN chunk_size=16MB`).
6. **Queue Engine:** Prioritas antrean BullMQ (*Critical, High, Normal, Low*).
7. **Telemetry Engine:** Real-time RPC rate monitor, latency MS, & FloodWait predictor.
8. **Recovery Engine & Storage Doctor:** 1-Click self-healing & MTProto reference refresh.
9. **AI Engine:** Tesseract OCR visual reader & file relationship mapper (`movie.mp4` ➔ `subtitle.srt`).
10. **Security Engine:** Client-side AES-256-GCM E2EE & Chameleon Stealth Disguise Mode.

### 🤖 Telegram Bot Subsystem:
- **Bot Manager (grammy):** Per-user bot instance lifecycle (*register, start, stop, unregister*) via `@BotFather` token.
- **Bot Commands (12 commands):** `/start`, `/getid`, `/help`, `/search`, `/list`, `/info`, `/download`, `/share`, `/status`, `/stats`, `/upload`, `/cancel`.
- **Authorization System:** Linked user + *Allowed IDs* CSV whitelist. Unauthorized users receive denial message.
- **Direct File Transfer:** `/download` sends files directly via MTProto + Bot API. `/upload` stores files sent to bot with auto-sync.
- **REST API Routes:** `GET /bot/status`, `POST /bot/register`, `DELETE /bot/unregister`, `POST /bot/restart`, `GET/PUT /bot/allowed-ids`.

---

## ⚙️ Requirements & Prerequisites

Sebelum menginstal TDrive, pastikan sistem Anda telah terpasang:
- **Node.js:** v20.x atau v22+ LTS (`node -v`)
- **Package Manager:** `npm` v10+ (atau `pnpm` / `bun`)
- **Database:** PostgreSQL v16+
- **In-Memory Cache & Queue:** Redis v7+
- **Operating System:** Windows 10/11 / Windows Server / Linux (Ubuntu, Debian, CentOS) / macOS

---

## 🛠️ Quick Start & Installation Guide (Panduan Instalasi)

### 1. Clone Repository
```bash
git clone https://github.com/tvpmw/TDrive.git
cd TDrive
```

### 2. Install Project Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Salin file `.env.example` menjadi `.env` di root direktori:
```bash
cp .env.example .env
```

Buka file `.env` dan konfigurasikan koneksi Database & Secrets Anda:
```env
# Database PostgreSQL
DATABASE_URL=postgresql://postgres:password_anda@localhost:5432/tdrive

# Redis (BullMQ Queue)
REDIS_URL=redis://localhost:6379

# Secrets (Ganti dengan string acak 32+ karakter)
JWT_SECRET=rahasia_jwt_minimal_32_karakter_acak
ENCRYPTION_KEY=rahasia_enkripsi_32_karakter_acak

# Telegram API Fallback (Opsional, pengguna dapat menghubungkan via UI)
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=your_telegram_api_hash_here
TELEGRAM_SESSION=
TDRIVE_STORAGE_CHANNEL=TeleDrive Storage
```

### 4. Database Setup & Migration
Jalankan migrasi skema database PostgreSQL menggunakan Drizzle ORM:
```bash
# Push skema ke database PostgreSQL
npm run db:push
```

### 5. Run Local Development Server
Jalankan backend API & frontend Next.js secara simultan:
```bash
npm run dev
```

Secara default:
- 🌐 **Frontend Application:** `http://localhost:3000`
- ⚙️ **Backend Hono API:** `http://localhost:3001`
- 📊 **Enterprise Command Dashboard:** `http://localhost:3000/dashboard`

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Menjalankan Frontend Web (`:3000`) & Backend API (`:3001`) secara bersamaan |
| `npm run build` | Melakukan kompilasi produksi untuk seluruh workspace (`apps/web`, `apps/api`, `packages/shared`) |
| `npm run build:web` | Kompilasi khusus aplikasi frontend Next.js 16 |
| `npm run build:api` | Type-check & kompilasi backend Hono API |
| `npm run db:push` | Membarukan skema PostgreSQL langsung dari Drizzle ORM |

---

## 🚀 Deployment (Production Native Node.js / PM2)

### One-Click Deploy Scripts

TDrive menyediakan otomasi deploy untuk Linux dan Windows:

```bash
# Linux (Ubuntu/Debian/CentOS)
bash deploy/setup-linux.sh

# Windows (PowerShell as Admin)
powershell -ExecutionPolicy Bypass -File deploy\setup-windows.ps1
```

Script otomatis menginstall dependencies, setup PostgreSQL & Redis, build produksi, konfigurasi nginx reverse proxy, dan menjalankan via PM2.

### Manual PM2 Deploy

```bash
# Build produksi
npm run build

# Start dengan ecosystem config
pm2 start ecosystem.config.cjs

# Simpan status PM2
pm2 save
pm2 startup
```

### Ecosystem Config (`ecosystem.config.cjs`)

PM2 menjalankan 2 proses:
- **tdrive-api:** Bun runtime, port 3001, auto-restart, 512MB memory limit
- **tdrive-web:** Next.js production, port 3000, auto-restart

### Nginx Reverse Proxy

```nginx
location /api/ { proxy_pass http://127.0.0.1:3001; }
location /bot/  { proxy_pass http://127.0.0.1:3001; }
location /storage/ { proxy_pass http://127.0.0.1:3001; }
location / { proxy_pass http://127.0.0.1:3000; }
```

---

## � Changelog

Lihat [CHANGELOG.md](CHANGELOG.md) untuk riwayat perubahan lengkap.

---

## �🛡️ License & Credits

Project ini dilisensikan di bawah **MIT License**. Dikembangkan oleh [tvpmw](https://github.com/tvpmw).
