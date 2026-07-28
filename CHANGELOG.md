# 📋 Changelog

Semua perubahan signifikan pada TDrive didokumentasikan di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/), versing mengikuti [Semantic Versioning](https://semver.org/).

---

## [0.1.0] - 2026-07-28

### ✨ New Features

#### 🤖 Telegram Bot Integration
- **Per-User Bot Instances:** Setiap pengguna dapat mendaftarkan bot Telegram pribadi via @BotFather di halaman Settings (`/settings`).
- **12 Bot Commands:**
  - `/start` — Hubungkan akun Telegram ke TDrive (1:1 mapping)
  - `/getid` — Tampilkan Telegram User ID untuk setup Allowed IDs
  - `/help` — Menu bantuan lengkap dengan daftar semua perintah
  - `/search <query>` — Cari file berdasarkan nama (ILIKE search, max 10 hasil)
  - `/list` — Tampilkan 10 file terbaru dari drive
  - `/info <filename>` — Metadata detail (tipe, ukuran, MIME, hash, download count, share link)
  - `/download <filename>` — Unduh file langsung ke chat Telegram (MTProto + Bot API)
  - `/share <filename>` — Generate share link publik
  - `/status` — Ringkasan penyimpanan (total size, file count, folder count)
  - `/stats` — Analitik detail per kategori (images, videos, documents, audio, archives, code, other)
  - `/upload` — Kirim file ke bot untuk disimpan di TDrive (auto-sync ke Telegram storage)
  - `/cancel` — Batalkan operasi state-based saat ini
- **Direct File Transfer:** `/download` mengunduh file dari MTProto storage lalu mengirim langsung via `ctx.replyWithDocument()`. `/upload` menerima file dari chat, download via Bot API, auto-sync ke MTProto, dan membuat record di database.
- **Duplicate Detection:** `/upload` melakukan SHA-256 hash check sebelum menyimpan — file duplikat ditolak dengan pesan yang informatif.

#### 🔐 Authorization System (Bot)
- **Linked User:** Pengguna pertama yang `/start` akan terhubung ke bot (1:1 mapping). Bot hanya melayani 1 TDrive user.
- **Allowed IDs Whitelist:** CSV-based whitelist di database. Pengguna dapat menambah/hapus ID Telegram yang diizinkan melalui UI Settings atau API (`GET/PUT /bot/allowed-ids`).
- **Denial Message:** Pengguna tidak terdaftar menerima pesan: *"Perintah ditolak, anda tidak memiliki hak akses ke bot ini."*
- **Protected Commands:** Semua perintah (`/help`, `/search`, `/list`, `/info`, `/download`, `/share`, `/status`, `/stats`, `/upload`, `/cancel`) dilindungi authorization. Hanya `/getid` yang tetap terbuka.

#### ⚙️ Bot Management UI (`/settings`)
- **Bot Info Grid:** Nama, username, bot ID, canJoinGroups, canReadMessages, supportsInline.
- **Status Indicator:** Running/offline status dengan indikator hijau/merah.
- **Token Input:** Input field dengan type password untuk registrasi bot token dari @BotFather.
- **Connected User Details:** Telegram user ID, username, nama, tanggal linking.
- **Allowed IDs Manager:** Input field untuk menambah ID, daftar ID yang sudah ada dengan tombol remove.
- **Setup Instructions:** Panduan langkah demi langkah untuk membuat bot di @BotFather.

#### 🚀 Deploy Automation
- **Linux Script (`deploy/setup-linux.sh`):** Otomasi setup untuk Ubuntu/Debian/CentOS — install dependencies, PostgreSQL, Redis, Bun, build, PM2, nginx reverse proxy.
- **Windows Script (`deploy/setup-windows.ps1`):** Otomasi setup untuk Windows (PowerShell as Admin) — install dependencies, PostgreSQL, Redis, Bun, build, PM2, nginx.
- **Nginx Config (`deploy/nginx.conf`):** Reverse proxy siap pakai — route `/api/`, `/bot/`, `/storage/` ke API port 3001, sisanya ke Next.js port 3000.
- **PM2 Ecosystem (`ecosystem.config.cjs`):** Process manager config — 2 proses (Bun API + Next.js), auto-restart, 512MB memory limit.

#### 📡 Bot REST API
- `GET /bot/status` — Running status, bot info (via `getMe()`), linked accounts
- `POST /bot/register` — Register & start bot dengan token
- `DELETE /bot/unregister` — Stop & unregister bot
- `POST /bot/restart` — Restart bot instance
- `GET /bot/allowed-ids` — Dapatkan daftar allowed IDs
- `PUT /bot/allowed-ids` — Update daftar allowed IDs

### 🔧 Improvements

- **Port Configuration:** Semua service diselaraskan ke port 3001 (API) dan 3000 (Web). Bun env loading diperbaiki untuk monorepo.
- **Next.js Proxy:** Tambahkan rewrites untuk `/bot/:path*` dan `/storage/:path*` ke API backend.
- **Trash Page Fix:** Perbaikan React Query v5 crash — `queryFn` returning `undefined` ditangani dengan `?? []` fallback.
- **DB Schema:** Ditambahkan kolom `telegramBotTokenEncrypted` (varchar 1024) dan `telegramAllowedIds` (varchar 2048) di tabel `users`. Tabel baru `bot_links` dan `bot_chat_states`.

### 📦 Dependencies

- Ditambahkan: `grammy` — Telegram Bot API framework

---

## [0.0.1] - 2026-07-01

### 🎉 Initial Release

#### Core Platform
- **Decoupled Monorepo:** Next.js 16 (App Router) + Hono API + PostgreSQL 16 + Redis/BullMQ
- **Runtime:** Bun (bukan Node.js) untuk API backend
- **Database:** PostgreSQL 16 dengan Drizzle ORM (schema push, bukan migration)
- **Queue:** Redis + BullMQ untuk async workers

#### 📊 Enterprise Command Dashboard (`/dashboard`)
- Dual Storage Allocation Visualizer (Telegram Cloud vs Local Disk)
- 10 Core Internal Engines Live Radar
- Telegram Channel Capacity Heatmap & MTProto DC Matrix
- OS Hardware Profiler (CPU, RAM, Event Loop Latency)
- Live System Audit Stream

#### 📁 Drive Explorer (`/drive`)
- Full file management — upload, download, rename, delete, move
- Dynamic Storage Destination Selector (Private Channel vs Forum Topics)
- Drag & Drop Upload & Resumable HTTP Range Streaming
- Folder management with Forum Topic Mapping

#### 🧹 Smart Auto-Clean Deduplication (`/drive/duplicates`)
- SHA-256 hash matching untuk deteksi duplikat
- Smart 1-Original Preservation Engine
- Multi-Storage Provider Selector
- Batch soft-delete dengan space saved feedback

#### 🔐 Security Features
- Client-Side AES-256-GCM E2EE Security Vault (`/vault`)
- Chameleon Stealth Disguise Mode (`/stealth`)
- JWT Authentication (jose library)
- AES-256-GCM encryption untuk semua kredensial sensitif

#### 🔧 Additional Features
- Global Command Palette (`Ctrl+K`)
- Storage Doctor & Self-Healing System (`/api/enterprise/doctor`)
- Policy Engine DSL
- Trash & Recovery System (`/trash`)
- Network Monitoring (`/network`)
- Server Health & Benchmark (`/server`)
- Settings Page (`/settings`)
- WebDAV Protocol Support
- SSE (Server-Sent Events) untuk real-time updates
- Smart Auto-Clean Deduplication Engine

#### 📦 Core Dependencies
- **Frontend:** Next.js 16, React 19, TanStack Query v5, TailwindCSS, Lucide Icons, Radix UI
- **Backend:** Hono, Drizzle ORM, jose (JWT), bcryptjs
- **Telegram:** gramjs (MTProto), Custom Client Pool
- **Queue:** BullMQ, Redis
- **Build:** TypeScript 5, Bun
