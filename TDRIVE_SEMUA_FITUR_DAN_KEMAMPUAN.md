# 🚀 TDrive - Comprehensive Product Specification & Capabilities

**TDrive** adalah ekosistem Cloud Storage Enterprise berperforma tinggi yang mengintegrasikan jaringan **Telegram MTProto Storage** sebagai backend penyimpanan tak terbatas. TDrive menggabungkan Pengalaman Pengguna (*User Experience* setara Google Drive / Dropbox) dengan kemampuan operasional **10 Internal Subsystem Engines** dan *Background Worker Pipeline*.

---

## ⚡ Core Capabilities At a Glance

- [x] **Unlimited Cloud Storage:** Menggunakan infrastruktur cloud Telegram MTProto secara aman.
- [x] **Enterprise Command & Storage Analytics Dashboard (`/dashboard`):** Dashboard analitik real-time dengan filter waktu (*Live, 24h, 7d, 30d*), radar 10 engine, heatmap kanal, dan profiler hardware OS.
- [x] **Smart Auto-Clean Deduplication (`/drive/duplicates`):** Pemindai 1-klik yang otomatis menyisakan 1 berkas asli (*Keep 1 Original File*) dan membersihkan seluruh salinan duplikat secara masal.
- [x] **10 Internal Engines Architecture:** Storage, Lifecycle, Planner, Worker, Policy, Queue, Telemetry, Recovery, AI, Security Engines.
- [x] **Storage Doctor System (`/api/enterprise/doctor`):** Pemindai & pemulih otomatis 1-klik untuk orphan chunks & expired file_references.
- [x] **Policy Engine DSL:** Penilai aturan otomatis (`IF size > 4GB THEN chunk_size=16MB`, `IF age > 180d THEN archive`).
- [x] **Deduplicated Storage:** Hash matching SHA-256 untuk pengunggahan 0-detik (instant upload).
- [x] **Client-Side E2EE:** Enkripsi AES-256-GCM + PBKDF2/Argon2id sebelum diunggah ke Telegram.
- [x] **Folder & Forum Topic Mapping:** Pemetaan folder TDrive 1:1 menjadi Telegram Forum Topics.
- [x] **Global Command Palette (`Ctrl+K`):** Navigasi dan pencarian instan dari mana saja.
- [x] **Resumable HTTP Range Streaming:** Pengunduhan file besar berbasis byte-range yang dapat dilanjutkan.
- [x] **Self-Healing & Checksum Verification:** Deteksi dan pemulihan otomatis chunk yang rusak.

---

## 💻 Technology Stack (Native Node.js Setup)

```text
Frontend Layer
├── Next.js 16 (App Router & Server Actions)
├── React 19
├── TailwindCSS (Vanilla CSS Custom System)
├── TanStack Query (React Query v5)
└── Lucide Icons & Radix UI Primitives

Backend Layer
├── Hono (Node.js High-Performance Framework)
├── Node.js 24 LTS & TypeScript 5
├── PostgreSQL 16 & Drizzle ORM
└── Redis & BullMQ (Async Queue Management)

Telegram Infrastructure
├── MTProto Protocol Layer
├── GramJS Telegram Client Pool
└── Custom Chunk & Channel Router Engine
```

---

## 📋 Fitur Produk Lengkap (Product Features)

### 1. 📊 Enterprise Command Dashboard (`/dashboard`)
- **Dual Storage Allocation Visualizer:** Perbandingan kapasitas **Telegram Cloud Storage** vs **Local Server Disk Storage (Windows / Linux)**.
- **10 Core Internal Engines Live Radar:** Matriks radar real-time untuk pemantauan 10 engine internal (*Storage, Lifecycle, Planner, Worker, Policy, Queue, Telemetry, Recovery, AI, Security*).
- **Telegram Channel Capacity Heatmap & MTProto DC Matrix:** Visualisasi alokasi pesan per kanal Telegram dan koneksi latency Data Center Telegram (**DC1 - DC5**).
- **OS Hardware Profiler:** Pemantauan beban CPU per core (%), RAM RSS Node.js vs System RAM, dan Event Loop latency (ms).
- **Live System Audit Stream:** Stream log aktivitas sistem (*Deduplication hit, Chunk upload complete, Storage Doctor auto-repair trigger*).

### 2. ⚡ Smart Auto-Clean Duplicate Finder & Deduplication (`/drive/duplicates`)
- **Smart 1-Original Preservation Engine:** Secara cerdas mengidentifikasi dan **menyisakan 1 berkas asli** (berdasarkan tanggal pembuatan pertama / status favorit) dan membersihkan salinan duplikat lainnya.
- **Multi-Storage Provider Selector:** Filter pemindaian duplikat berbasis *All Storage, Telegram Cloud Storage,* atau *Server Storage*.
- **Live Feedback & Deleting Spinner:** Menampilkan indikator loading saat penghapusan dan notifikasi *success toast* kapasitas terhemat.

### 3. ⌨️ Global Command Palette (`Ctrl+K`)
- **Instant Launcher Modal:** Pengguna dapat menekan `Ctrl+K` atau `Cmd+K` di mana saja untuk meluncurkan modal pencarian instan file, folder, dan eksekusi aksi sistem.

### 4. 📁 File Management & Dynamic Storage Selector
- **Dynamic Storage Destination Selector:** *Telegram Private Channel Mode* vs *Telegram Supergroup Forum Topics Mode* (`createForumTopic`).
- **Drag & Drop Upload & Range Streaming:** Pengunggahan berkecepatan tinggi & pengunduhan HTTP 206 Partial Content.

---

## 🔐 Security & Encryption

- **Client-Side E2EE Security Vault (`/vault`):** Enkripsi AES-256-GCM + PBKDF2/Argon2id langsung di browser sebelum dikirim ke Telegram.
- **Chameleon Stealth Disguise Mode (`/stealth`):** Penyamaran header file rahasia menjadi berkas lagu `.mp3` atau gambar wallpaper secara otomatis di Telegram.
