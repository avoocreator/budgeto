# 💰 Budgeto — Catatan Keuangan Pribadi (v2)

Aplikasi catatan keuangan pribadi yang bisa di-install seperti aplikasi asli di HP: **offline-first, gratis 100%, tanpa iklan, tanpa Apps Script lagi.**

![Budgeto](public/icons/icon-192.png)

## ✨ Fitur

- 📊 **Dashboard** — saldo total, pemasukan/pengeluaran bulan ini, budget, target tabungan
- ⚡ **Catat super cepat** — tombol + besar, kategori satu ketukan, form bottom-sheet ala native
- 🌗 **Dark mode & Light mode** — desain compact minimalis
- 💸 **Multi dompet** — tunai, bank, e-wallet + transfer antar dompet
- 🎯 **Budget per kategori** — progress bar + notifikasi peringatan 80% & 100%
- 🐷 **Target tabungan** — dengan setor berkala & perayaan target tercapai
- 📈 **Laporan** — tren 6 bulan, komposisi kategori, aktivitas harian, insight
- 🔔 **Notifikasi** — tiap transaksi, peringatan budget, pengingat harian
- ☁️ **Cloud sync opsional** — backup otomatis & multi-device via Supabase free tier (email OTP, aman dengan RLS)
- 📴 **Offline penuh** — data tersimpan di perangkat (IndexedDB), jalan tanpa internet
- 📲 **PWA** — install langsung dari browser, shortcut cepat dengan tekan-lama ikon
- 🤖 **APK + Widget Android** — widget layar utama dengan saldo live & tombol catat cepat (build otomatis gratis via GitHub Actions)
- 📤 **Ekspor/Impor** — backup JSON + ekspor CSV untuk Excel/Sheets

## 🚀 Mulai Cepat

Semua langkah setup (deploy hosting gratis, cloud sync, sampai bikin APK + widget) ada di **[PANDUAN.md](./PANDUAN.md)** — ditulis untuk tanpa menyentuh kode sama sekali.

Versi singkat untuk developer:

```bash
bun install
bun run dev        # http://localhost:3000
bun run build      # static export ke folder out/
npx cap sync android
```

## 🏗️ Teknologi

- **Next.js 16** (App Router, static export) + TypeScript
- **Dexie.js** (IndexedDB) — database lokal offline-first
- **Supabase** (opsional) — cloud sync + auth email OTP dengan Row Level Security
- **Tailwind CSS 4 + shadcn/ui** — compact minimalist design
- **Recharts** — grafik laporan
- **next-themes** — dark/light mode
- **Capacitor** — pembungkus APK Android + home-screen widget
- **GitHub Actions** — CI auto-build APK gratis

## 🗂️ Struktur

Lihat bagian akhir [PANDUAN.md](./PANDUAN.md).
