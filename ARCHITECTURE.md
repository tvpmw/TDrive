# 🏛️ TDrive - System Architecture & Technical Specification

Dokumen ini khusus membahas **Arsitektur Sistem**, **Alur Eksekusi Data (Request Flow)**, **MTProto Mapping**, serta **10 Internal Subsystem Engines** dari platform **TDrive**.

---

## 1. High-Level System Architecture

TDrive beroperasi menggunakan arsitektur Decoupled Native Node.js & Next.js Monorepo (tanpa ketergantungan Docker Container):

```text
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                        Frontend Layer (Next.js 16)                       │
 │  - Enterprise Command Dashboard  - Global Command Palette (Ctrl+K)       │
 │  - Drive Explorer UI             - Telegram Ops Dashboard & Storage Heatmap│
 │  - Smart Auto-Clean Deduplicator - Security Vault & Stealth Disguise UI  │
 │  - Telegram Bot Settings & Allowed IDs Management UI                    │
 └────────────────────────────────────┬─────────────────────────────────────┘
                                      │ REST API / Server-Sent Events (SSE)
 ┌────────────────────────────────────▼─────────────────────────────────────┐
 │                         Backend Layer (Hono Node.js)                     │
 │  - Dashboard Telemetry API       - Storage Lifecycle Engine              │
 │  - Smart Deduplication Engine    - Security & AES-256 E2EE Vault        │
 │  - Telegram Bot Manager (grammy) - Bot Command Handler (12 commands)    │
 └─────────────┬──────────────────────┬──────────────────────┬──────────────┘
               │                      │                      │
 ┌─────────────▼──────────┐ ┌─────────▼──────────┐ ┌─────────▼──────────────┐
 │ PostgreSQL 16 Database │ │ Redis & BullMQ Queue│ │ MTProto Telegram Layer   │
 │ (Drizzle ORM Schema)   │ │ (Async Workers)     │ │ (GramJS Client Pool)     │
 └────────────────────────┘ └────────────────────┘ └────────────────────────┘
```

---

## 2. Decoupled 10 Core Internal Subsystem Engines

Sistem internal TDrive terbagi menjadi 10 modul engine mandiri yang terstruktur:

1. **Storage Engine:** Mengatur penempatan chunk, consistent hashing, dan pemilihan mode penyimpanan (*Private Channel* vs *Supergroup Forum Topics*).
2. **Lifecycle Engine:** Mengontrol alur state machine file (`CREATED` ➔ `QUEUED` ➔ `UPLOADING` ➔ `VERIFYING` ➔ `READY` ➔ `SHARED` ➔ `ARCHIVED` ➔ `TRASHED` ➔ `PURGED`).
3. **Planner Engine:** Smart upload planner yang menentukan chunk size adaptif (512KB - 16MB) dan alokasi akun.
4. **Worker Engine:** Mengelola 12 handler background worker (*UploadWorker, DownloadWorker, PreviewWorker, ThumbnailWorker, OCRWorker, AIWorker, QueueWorker, IntegrityWorker, FileRefWorker, CleanupWorker, BackupWorker, NotificationWorker*).
5. **Policy Engine (Rules Evaluator DSL):** Evaluator aturan kustom (`IF size > 4GB THEN chunk_size=16MB`, `IF age > 180d THEN archive`).
6. **Queue Engine:** Penjadwalan antrean berprioritas (*Critical, High, Normal, Low*) berbasis BullMQ.
7. **Telemetry Engine:** Pemantauan real-time RPC/s, latency MS, status FloodWait, dan rate monitor.
8. **Recovery Engine & Storage Doctor:** Diagnostik dan pemulihan otomatis 1-klik untuk menangani orphan chunks, expired file references, dan rebalance channel.
9. **AI Engine:** Modul pengenalan visual OCR dan pemetaan keterikatan berkas (*File Relationship Mapping*).
10. **Security Engine:** Client-side AES-256-GCM + PBKDF2/Argon2id E2EE Vault & Stealth Disguise Mode.

---

## 2.1 Telegram Bot Subsystem Architecture

TDrive mendukung **Telegram Bot Integration** yang memungkinkan pengguna mengelola file langsung dari chat Telegram. Bot menggunakan library **grammy** (Bot API) dan berjalan secara terpisah per pengguna (*per-user bot instances*).

```text
 User (Telegram App)            TDrive Backend
       │                              │
       │──── /command ──────────────▶│ grammy Bot Handler
       │                              │   ├── requireAuth() ──▶ PostgreSQL (allowed IDs)
       │                              │   ├── /download ──────▶ MTProto downloadFile()
       │                              │   ├── /upload ────────▶ Bot API getFile() → MTProto uploadFile()
       │                              │   ├── /search ────────▶ PostgreSQL (drive_items ILIKE)
       │                              │   └── /share ─────────▶ PostgreSQL (shareToken)
       │◀── reply (text/file) ────────│
```

**Bot Manager (`bot-manager.ts`):** Mengelola lifecycle bot per pengguna:
- `registerBot(userId, token)` — Simpan token terenkripsi, buat instance grammy
- `startBot(userId)` — Mulai polling/gracefulStop
- `stopBot(userId)` — Hentikan bot instance
- `unregisterBot(userId)` — Hapus token & stop bot
- `getBotInfo(userId)` — Dapatkan info bot via `getMe()`
- `startAllBots()` — Mulai semua bot saat server boot

**Bot Commands (`bot-commands.ts`):** 12 command handler dengan authorization guard:
- `requireAuth(ctx)` — Cek linked user OR allowed IDs CSV. Kirim pesan penolakan jika unauthorized.
- `/start` — Link Telegram user → TDrive user (1:1 mapping)
- `/getid` — Tampilkan Telegram User ID (tidak dilindungi auth)
- `/download` — Fetch via MTProto, kirim via Bot API (`ctx.replyWithDocument`)
- `/upload` — Download dari Bot API, hash check, auto-sync ke MTProto storage
- `/search`, `/list`, `/info`, `/share`, `/status`, `/stats`, `/cancel` — Query PostgreSQL + format output

**Bot Routes (`bot.ts`):** REST API endpoints:
- `GET /bot/status` — Running status, bot info, linked accounts
- `POST /bot/register` — Register & start bot
- `DELETE /bot/unregister` — Stop & unregister bot
- `POST /bot/restart` — Restart bot instance
- `GET /bot/allowed-ids` — Dapatkan daftar allowed IDs
- `PUT /bot/allowed-ids` — Update daftar allowed IDs

---

## 2.2 Deploy Automation Architecture

TDrive menyediakan script deploy otomatis untuk production deployment:

```text
 deploy/
 ├── setup-linux.sh      — Instalasi otomatis Linux (Ubuntu/Debian/CentOS)
 ├── setup-windows.ps1   — Instalasi otomatis Windows (PowerShell)
 └── nginx.conf          — Konfigurasi nginx reverse proxy

 ecosystem.config.cjs    — PM2 process manager config
 └── tdrive-api (Bun, port 3001, 512MB limit)
 └── tdrive-web (Next.js, port 3000)
```

**Deploy Flow:**
```text
  Setup Script
       │
       ▼
 [Install System Deps] → [Install Bun] → [npm install]
       │
       ▼
 [Setup PostgreSQL & Redis] → [Create .env] → [npm run db:push]
       │
       ▼
 [npm run build] → [PM2 Start] → [Configure nginx] → [pm2 save && pm2 startup]
```

---

## 3. Dedicated Dashboard & Telemetry API (`/api/dashboard/stats`)

Endpoint `/api/dashboard/stats` mengonsolidasi telemetri sistem secara real-time:
- **Telegram Storage:** Total Bytes, Channels Count, Mode (*Private Channel* vs *Forum Topic*), Hash Deduplication Savings.
- **Server Disk Storage:** OS Platform (`win32`/`linux`), Disk Total, Used, Free Space, App Local Bytes.
- **Hardware Metrics:** CPU Cores, CPU Load %, Memory RSS, Heap Used, Event Loop Latency (ms).
- **10 Engine Status Matrix & Audit Logs Stream.**

---

## 4. Smart Auto-Clean Deduplication Architecture (`/api/enterprise/duplicates/smart-delete`)

Proses deduplikasi pintar (*Smart Auto-Clean*) mengevaluasi grup duplikat dan mempertahankan 1 file asli:

```text
  Client Trigger (Smart Clean Group / All)
                     │
                     ▼
       ┌──────────────────────────┐
       │ Smart Selector Engine    │
       └─────────────┬────────────┘
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
[Keep Oldest Original File]    [Queue Duplicate Copy IDs]
     │                               │
     └───────────────┬───────────────┘
                     │
                     ▼
       ┌──────────────────────────┐
       │ Batch Soft-Delete DB &   │
       │ Return Space Saved Bytes │
       └──────────────────────────┘
```

---

## 5. Database Schema Overview (PostgreSQL + Drizzle ORM)

- **`users`:** Pengguna, kredensial terenkripsi, status Telegram session, mode penyimpanan, **bot token terenkripsi**, **allowed IDs CSV**.
- **`drive_items`:** Metadata berkas & folder, hirarki parent, ukuran, MIME, SHA-256 hash, E2EE IV.
- **`bot_links`:** Mapping akun Telegram → TDrive user (linked accounts, username, nama).
- **`bot_chat_states`:** State machine percakapan bot (idle, awaiting_search, dll).
- **`telegram_accounts`:** Pool akun MTProto, score kesehatan (1-5 bintang), latency ms, status FloodWait.
- **`item_chunk_manifests`:** Manifest pemecahan chunk file besar ke banyak message Telegram.
- **`saved_searches`:** Query pencarian tersimpan pengguna.
- **`file_relations`:** Pemetaan keterikatan berkas.
