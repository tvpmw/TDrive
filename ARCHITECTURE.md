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
 └────────────────────────────────────┬─────────────────────────────────────┘
                                      │ REST API / Server-Sent Events (SSE)
 ┌────────────────────────────────────▼─────────────────────────────────────┐
 │                         Backend Layer (Hono Node.js)                     │
 │  - Dashboard Telemetry API       - Storage Lifecycle Engine              │
 │  - Smart Deduplication Engine    - Security & AES-256 E2EE Vault        │
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

- **`users`:** Pengguna, kredensial terenkripsi, status Telegram session, mode penyimpanan.
- **`drive_items`:** Metadata berkas & folder, hirarki parent, ukuran, MIME, SHA-256 hash, E2EE IV.
- **`telegram_accounts`:** Pool akun MTProto, score kesehatan (1-5 bintang), latency ms, status FloodWait.
- **`item_chunk_manifests`:** Manifest pemecahan chunk file besar ke banyak message Telegram.
- **`saved_searches`:** Query pencarian tersimpan pengguna.
- **`file_relations`:** Pemetaan keterikatan berkas.
