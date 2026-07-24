# 🚀 TDrive - High-Performance Telegram Cloud Storage Engine

**TDrive** adalah ekosistem Cloud Storage Enterprise berperforma tinggi berbasis **Telegram MTProto Storage** yang dikembangkan menggunakan **Next.js 16 (React 19)**, **Hono API**, **PostgreSQL 16**, dan **Background Worker Engine** (Native Node.js / Laragon setup).

---

## 📚 Quick Documentation Index

- 📋 **Fitur & Kemampuan Lengkap:** [TDRIVE_SEMUA_FITUR_DAN_KEMAMPUAN.md](file:///e:/laragon/www/teledrive/TDrive/TDRIVE_SEMUA_FITUR_DAN_KEMAMPUAN.md)
- 🏛️ **Spesifikasi Arsitektur 10 Subsystem Engines:** [ARCHITECTURE.md](file:///e:/laragon/www/teledrive/TDrive/ARCHITECTURE.md)
- 📋 **Master Roadmap & Features:** [TDRIVE_FULL_FEATURES.md](file:///e:/laragon/www/teledrive/TDrive/TDRIVE_FULL_FEATURES.md)

---

## ⚡ Core Highlights

- **Unlimited Cloud Storage:** Memanfaatkan jaringan Telegram MTProto secara aman.
- **Enterprise Command Dashboard (`/dashboard`):** Monitoring analitik real-time untuk Telegram Cloud vs Local Server Storage, radar 10 engine internal, dan profiler hardware OS.
- **Smart Auto-Clean Deduplication (`/drive/duplicates`):** Pembersihan duplikat 1-klik yang otomatis menyisakan 1 file asli (*Keep 1 Original File*).
- **10 Decoupled Internal Subsystem Engines:** Storage, Lifecycle, Planner, Worker, Policy, Queue, Telemetry, Recovery, AI, Security.
- **Storage Doctor Diagnostic Repair (`/api/enterprise/doctor`):** Pemulihan otomatis 1-klik untuk orphan chunks, expired file references, dan optimasi rotasi channel.
- **Dynamic Storage Destination Selector:** Pilih antara *Telegram Private Channel* atau *Telegram Supergroup Forum Topics*.
- **Global Command Palette (`Ctrl+K`):** Navigasi instan & pencarian cepat di seluruh aplikasi web.
- **Client-Side E2EE Security Vault (`/vault`):** Enkripsi AES-256-GCM + PBKDF2/Argon2id langsung di browser.
