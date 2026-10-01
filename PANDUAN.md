# 📱 PANDUAN LENGKAP BUDGETO v2

> **Panduan ini ditulis untuk orang yang TIDAK MAU Nyentuh KODE sama sekali.**
> Semua langkah hanya klik-klik di website. Tidak perlu install aplikasi apa pun di laptop.
> Total biaya: **Rp0** selamanya (semua pakai free tier).

---

## 🗺️ Peta Panduan (bacakan sesuai kebutuhan)

| Bagian | Isi | Wajib? |
|--------|-----|--------|
| [Bagian 0](#bagian-0) | Penjelasan apa yang berubah | Baca dulu ✅ |
| [Bagian 1](#bagian-1) | Pakai aplikasi di preview | Bisa langsung ✅ |
| [Bagian 2](#bagian-2) | Upload project ke GitHub | Wajib (untuk deploy) ✅ |
| [Bagian 3](#bagian-3) | Deploy web gratis di Vercel + install di HP | Wajib ✅ |
| [Bagian 4](#bagian-4) | Notifikasi & izin di HP | Wajib (klik saja) ✅ |
| [Bagian 5](#bagian-5) | Cloud sync + backup via Supabase | Opsional (disarankan) ☁️ |
| [Bagian 6](#bagian-6) | **APK Android + WIDGET layar utama** | Opsional (ini yang kamu mau!) 📱 |
| [Bagian 7](#bagian-7) | Pindah HP / backup / restore | Kalau butuh |
| [Bagian 8](#bagian-8) | Troubleshooting & FAQ | Kalau ada masalah |
| [Bagian 9](#bagian-9) | Jalankan project di komputer sendiri (npm, Windows/Mac/Linux) | Opsional 🖥️ |

---

<a name="bagian-0"></a>
## Bagian 0 — Apa Saja yang Berubah dari Versi Lama?

| | Budgeto v1 (lama) | Budgeto v2 (baru) |
|---|---|---|
| Database | Google Sheets + Apps Script | **IndexedDB di HP kamu** (offline, super cepat) + opsional cloud Supabase |
| Notifikasi | Tidak ada | Notifikasi tiap transaksi, peringatan budget 80%/100%, pengingat harian |
| Tema | Dark saja | **Dark mode + Light mode** (tombol bulan/matahari di pojok kanan atas) |
| Desain | Biasa saja | Kompak & minimalis, ala aplikasi native, bottom navigation + tombol + |
| Fitur baru | — | Dompet multi-akun, transfer antar dompet, budget per kategori, grafik laporan 6 bulan, insight, ekspor CSV/JSON |
| Widget | Tidak ada | **Widget layar utama Android** (saldo + tombol cepat catat) lewat APK |
| Biaya | Gratis | **Tetap gratis 100%** |

Cara kerja data (penting dipahami):
- Semua transaksi tersimpan **di HP/browser kamu sendiri** (IndexedDB). Tidak ada server yang melihat datamu.
- Buka aplikasi tanpa internet? **Tetap jalan normal**. Data masuk lagi saat online.
- Kalau kamu mengaktifkan cloud sync (Bagian 5), data ikut ter-backup otomatis ke akun Supabase milikmu sendiri, dan bisa dibuka dari HP lain dengan login email yang sama.

---

<a name="bagian-1"></a>
## Bagian 1 — Coba Aplikasinya Sekarang (di Preview)

1. Buka panel **Preview** di sebelah kanan.
2. Kamu langsung melihat Dashboard. Coba:
   - Tekan tombol **+** hijau besar → pilih "Keluar" → ketik jumlah → pilih kategori → **Simpan Transaksi**.
   - Tekan ikon 🌙/☀️ di pojok kanan atas → ganti Dark/Light mode.
   - Menu bawah: **Beranda · Transaksi · ( + ) · Laporan · Menu**.
3. Di **Menu** ada semua fitur: Target Tabungan, Budget, Dompet, Kategori, Pengaturan.

> ⚠️ Catatan: di mode preview ini beberapa fitur browser (install PWA, notifikasi, widget) **baru aktif penuh setelah di-deploy online** (Bagian 3) atau lewat APK (Bagian 6). Itu normal — aturan browsernya begitu.

---

<a name="bagian-2"></a>
## Bagian 2 — Upload Project ke GitHub (± 10 menit)

Kita akan ganti isi repo `Budgeto_Financial` lama dengan kode baru ini.

### Langkah 2.1 — Unduh semua file project
1. Di halaman chat ini, unduh/ekstrak folder project lengkap (folder `my-project`) menjadi **ZIP**.
2. Ekstrak ZIP-nya di komputer (atau langsung di HP — bisa, karena semua via browser).

### Langkah 2.2 — Bersihkan file lama di GitHub
1. Buka **https://github.com** → login → masuk ke repo **avoocreator/Budgeto_Financial**.
2. Klik daftar file → hapus file-file versi lama satu per satu:
   - Klik nama file → klik ikon **titik tiga (⋮)** kanan atas → **Delete file** → **Commit changes**.
   - Hapus: `Code.gs`, `app.js`, `index.html`, `style.css`, `manifest.json`, `icon-192.png`, `icon-512.png`, `README.md`.
3. Sekarang repo kosong. (Kalau ribet: alternatifnya buat repo BARU bernama `budgeto-v2` di akunmu, ikuti sisa langkah di repo baru itu.)

### Langkah 2.3 — Upload kode baru
1. Di halaman repo (yang sudah kosong), klik tautan **"uploading an existing file"** (atau klik **Add file → Upload files**).
2. **Drag & drop SEMUA isi folder project** yang tadi di ekstrak (folder `src`, `public`, `android`, `.github`, dan file lainnya — SEMUA kecuali folder `node_modules`, `.next`, dan `budgeto-old` kalau ada).
   - Untuk mengupload folder beserta isinya: drag foldernya sekaligus ke area upload; GitHub akan mempertahankan struktur foldernya.
   - **PENTING**: folder `.github` diawali titik — kadang tersembunyi di file explorer. Pastikan ter-upload (ini berisi mesin auto-build APK!).
   - **JANGAN upload**: folder `node_modules`, folder `.next`, folder `budgeto-old`.
3. Tulis pesan commit: `Budgeto v2` → klik **Commit changes**.
4. Tunggu sampai semua file muncul di repo.

> 💡 Kalau ada file yang menolak di-upload karena ukuran (biasanya tidak ada di project ini), lewati saja — lapor ke aku nanti.

---

<a name="bagian-3"></a>
## Bagian 3 — Deploy Web Gratis di Vercel + Install di HP (± 5 menit)

### Langkah 3.1 — Deploy
1. Buka **https://vercel.com** → klik **Sign Up** → pilih **Continue with GitHub** (pakai akun GitHub kamu, gratis).
2. Klik **Add New... → Project**.
3. Cari repo **Budgeto_Financial** → klik **Import**.
4. Biarkan semua pengaturan **DEFAULT** (Vercel otomatis mendeteksi Next.js). **Jangan ubah apa pun.**
5. Klik **Deploy** → tunggu ± 1–2 menit sampai muncul 🎉 kembang api.
6. Kamu dapat alamat web seperti: `https://budgeto-financial.vercel.app` — **ini alamat aplikasimu selamanya, gratis.**

### Langkah 3.2 — Install jadi aplikasi di HP
**Android (Chrome):**
1. Buka alamat Vercel tadi di Chrome.
2. Akan muncul banner/ikon **Install** (ikon ⬇️ di pojok kanan atas aplikasi juga bisa — itu tombol install bawaan yang aku pasang).
3. Atau manual: menu **⋮** → **Tambahkan ke layar utama / Install app**.
4. Ikon Budgeto muncul di layar utama. Buka = langsung app penuh layar, tanpa address bar. ✅

**iPhone (Safari):**
1. Buka alamat Vercel tadi di Safari.
2. Tombol **Share** (kotak dengan panah) → **Add to Home Screen** → **Add**.

### Langkah 3.3 — Aktifkan notifikasi
1. Buka aplikasi (yang dari layar utama) → **Menu → Pengaturan → Notifikasi**.
2. Nyalakan **"Izinkan notifikasi HP"** → browser meminta izin → **Izinkan**.
3. Nyalakan juga: notif tiap transaksi, peringatan budget, pengingat harian (+ atur jamnya).

Sekarang setiap kamu mencatat transaksi → muncul notifikasi HP. Budget terpakai 80% → ada peringatan. Belum catat keuangan sampai jam pengingat → diingatkan. 🔔

---

<a name="bagian-4"></a>
## Bagian 4 — Ringkasan Fitur Notifikasi

| Notifikasi | Kapan muncul | Cara atur |
|---|---|---|
| "Pengeluaran dicatat" / "Pemasukan dicatat" | Setiap kali simpan transaksi | Pengaturan → Notif tiap transaksi |
| "Budget hampir habis" (80%) | Saat pengeluaran kategori menyentuh 80% budget | Pengaturan → Peringatan budget |
| "Budget terlampaui!" (100%) | Saat melewati budget | Pengaturan → Peringatan budget |
| "Target tercapai 🎉" | Saat tabungan penuh | Otomatis |
| "Jangan lupa catat keuangan 💰" | Jam yang kamu atur, kalau belum catat pengeluaran hari itu | Pengaturan → Pengingat harian |

> ℹ️ Catatan jujur soal pengingat harian: kalau aplikasi ditutup total oleh sistem Android, pengingat berbasis browser bisa telat/hilang. Di **APK Android (Bagian 6)** pengingat lebih andal, dan widget tetap bisa refresh tiap ±30 menit. Ini keterbatasan semua web app di Android, bukan bug Budgeto.

---

<a name="bagian-5"></a>
## Bagian 5 — Cloud Sync + Backup Otomatis via Supabase (Gratis, Opsional tapi Disarankan)

Ini pengganti Google Sheets/AppScript yang lama. Datamu tetap milikmu — tersimpan di akun Supabase milikmu sendiri. Tanpa ini aplikasi tetap jalan normal (data di HP), tapi tanpa backup online & tidak bisa multi-device.

### Langkah 5.1 — Buat akun & project Supabase
1. Buka **https://supabase.com** → **Start your project** → sign up (bisa pakai GitHub).
2. Klik **New project** → isi:
   - Name: `budgeto`
   - Database Password: (boleh di-generate, tidak dipakai manual — simpan saja)
   - Region: **Singapore** (paling dekat dengan Indonesia)
3. Klik **Create new project** → tunggu ± 2 menit.

### Langkah 5.2 — Buat tabel (copy-paste, tanpa coding)
1. Di sidebar kiri Supabase, klik ikon **SQL Editor** (logo `>_`).
2. Klik **New query**.
3. Buka file **`supabase-schema.sql`** dari project ini (bisa dibuka pakai notepad/HP), **salin SEMUA isinya**, tempel ke kotak SQL.
4. Klik **Run** (atau Ctrl+Enter).
5. Muncul "Success. No rows returned" → tabel siap ✅

### Langkah 5.3 — Ambil 2 kunci
1. Di sidebar kiri, klik **⚙️ Project Settings → API**.
2. Salin 2 nilai ini ke notepad:
   - **Project URL** → bentuknya `https://abcdefgh.supabase.co`
   - **anon public key** (yang "Project API Keys → anon public") → panjang, diawali `eyJ...`
   - ⚠️ JANGAN pakai yang `service_role` (kunci rahasia backend).

### Langkah 5.4 — Hubungkan di aplikasi Budgeto
1. Buka Budgeto → **Menu → Pengaturan → Sinkronisasi Cloud**.
2. Tempel **Project URL** ke kolom pertama, **anon key** ke kolom kedua.
3. Isi **email kamu** → klik **Kirim Kode ke Email**.
4. Cek inbox → ada kode **6 digit** → masukkan di aplikasi → **Verifikasi & Masuk**.
5. Selesai! Aplikasi langsung men-sync semua data. Sejak sekarang setiap perubahan otomatis ter-backup ✅
6. HP kedua? Install aplikasinya, isi kunci yang sama, login email yang sama → data langsung ter-download. 🔄

> 🔒 Keamanan: tiap pengguna hanya bisa melihat datanya sendiri (dilindungi Row Level Security). Kunci `anon` memang boleh publik — yang menjaga datamu adalah login email + RLS.

---

<a name="bagian-6"></a>
## Bagian 6 — APK Android + WIDGET LAYAR UTAMA 📱 (Gratis, via GitHub Actions)

Ini bagian yang kamu tunggu: **widget asli di layar utama HP** — menampilkan saldo + tombol cepat "− Keluar" / "+ Masuk" yang langsung membuka form catat transaksi.

Caranya: GitHub membangunkan APK **secara gratis** setiap kali repo ter-update. Kamu hanya tinggal mengunduh APK-nya.

### Langkah 6.1 — Build APK pertama
1. Buka repo kamu di GitHub → tab **Actions**.
2. Kalau muncul tulisan "Workflows aren't being run on this forked repository", klik tombol **"I understand my workflows, go ahead and enable them"**.
3. Klik workflow **"Build APK Budgeto"** di sidebar kiri.
4. Klik **Run workflow** → **Run workflow** (tombol hijau).
5. Tunggu ± 5–8 menit. Akan terlihat lingkaran berputar 🟡 → ✅ hijau.
6. Klik run yang selesai → scroll ke bawah ke bagian **Artifacts** → unduh **Budgeto-APK**.
   - Atau lebih enak: buka tab **Releases** di repo → ada release **"Budgeto APK (terbaru)"** → unduh **Budgeto.apk** (link ini bisa dibuka langsung dari HP!).

### Langkah 6.2 — Install APK di HP Android
1. Unduh `Budgeto.apk` dari HP (buka halaman Releases di Chrome HP).
2. Ketuk file-nya → Android bertanya "izinkan install dari sumber ini?" → **Izinkan**.
3. Muncul peringatan Play Protect ("aplikasi tidak dikenal") → **Tetap install** (ini karena APK dibuat untuk dirimu sendiri, bukan dari Play Store — normal dan aman karena kodenya adalah kodemu sendiri).
4. Buka aplikasi Budgeto (yang ikonnya sekarang logo dompet hijau ✨).

### Langkah 6.3 — Pasang widget di layar utama
1. Tekan lama area kosong di layar utama → pilih **Widgets**.
2. Cari **Budgeto** → pilih widget-nya → letakkan di layar utama.
3. Widget menampilkan: judul Budgeto, saldo, ringkasan masuk/keluar bulan ini, dan 2 tombol:
   - **− Keluar** → langsung membuka form catat pengeluaran
   - **+ Masuk** → langsung membuka form catat pemasukan
4. Tekan ikon **⟳** di widget untuk refresh manual. Otomatis refresh ± tiap 30 menit.

### Langkah 6.4 — (Opsional) Bikin widget tampilkan SALDO LIVE dari cloud
Widget butuh "kunci rahasia" untuk membaca ringkasan saldo dari Supabase. Semuanya lewat klik-klik di web:

1. **Pastikan Bagian 5 (Supabase) sudah selesai** dan kamu sudah login di aplikasi + tekan **Sinkron sekarang** minimal satu kali.
   - Ini membuat **WIDGET_TOKEN** (kunci rahasia otomatis). Lihat di: **Menu → Pengaturan → Widget Android** → tekan **Salin** pada WIDGET_TOKEN, SUPABASE_URL, dan SUPABASE_ANON_KEY. Simpan 3 nilai ini di notepad.
2. Buka repo GitHub → tab **Settings** (di bar atas repo) → sidebar kiri **Secrets and variables → Actions**.
3. Klik **New repository secret**, buat 3 kali:
   - Name: `SUPABASE_URL` → Secret: tempel Project URL
   - Name: `SUPABASE_ANON_KEY` → Secret: tempel anon key
   - Name: `WIDGET_TOKEN` → Secret: tempel WIDGET_TOKEN
4. Buka tab **Actions → Build APK Budgeto → Run workflow** lagi → tunggu selesai.
5. Unduh APK terbaru dari **Releases** → install ulang (cukup ketuk file, tidak perlu uninstall).
6. Sekarang widget menampilkan **saldo live** + masuk/keluar bulan berjalan 🎉

### Catatan penting soal APK & update
- Setiap kali aku/kamu update kode web dan push ke GitHub, GitHub Actions **otomatis membuat APK baru** di Releases. Cukup install ulang APK-nya.
- **Data di aplikasi tidak hilang** saat install ulang APK (tersimpan di penyimpanan aplikasi + cloud).
- APK ini bertipe "debug signed" — untuk pemakaian pribadi sudah sempurna dan bisa di-install normal. Kalau suatu saat mau publish ke Play Store, itu langkah lanjutan (tanya aku nanti).

---

<a name="bagian-7"></a>
## Bagian 7 — Backup, Restore, Pindah HP

**Backup manual (paling cepat):**
- **Menu → Pengaturan → Data & Backup → Backup data (JSON)** → file tersimpan di HP.
- Ekspor Excel: **Ekspor ke Excel/CSV** → buka di Google Sheets/Excel.

**Restore:**
- **Pulihkan dari backup** → pilih file JSON backup.

**Pindah HP / restore tanpa file:**
1. Di HP lama: pastikan cloud sync aktif (Bagian 5) → tunggu status "tersinkron".
2. Di HP baru: install app → isi kunci Supabase yang sama → login email yang sama → data otomatis ter-download.

**Mulai dari nol:**
- **Pengaturan → Hapus semua data** (backup dulu kalau perlu!).

---

<a name="bagian-8"></a>
## Bagian 8 — Troubleshooting & FAQ

**❓ Muncul "'cp' is not recognized" atau "'tee' is not recognized" saat npm run build/dev**
- Itu bug di package.json versi lama (perintah khusus Linux). Sudah diperbaiki di ZIP terbaru — cukup ganti file `package.json` kamu dengan yang baru (tidak perlu `npm install` ulang), lalu ulangi perintahnya.

**❓ Notifikasi tidak muncul**
- Cek: Pengaturan → Notifikasi → status harus "Sudah aktif ✓". Kalau tidak, toggle "Izinkan notifikasi HP" lagi dan pilih **Izinkan**.
- Cek pengaturan Android: **Settings → Apps → Budgeto/Chrome → Notifications** → aktif.
- Pastikan aplikasi dibuka dari ikon layar utama (bukan tab browser biasa).

**❓ Tombol Install PWA tidak muncul di Chrome**
- Harus via alamat **https://** (alamat Vercel sudah https ✅).
- Chrome kadang butuh 1x buka-tutup aplikasi dulu. Atau pakai menu ⋮ → "Install app".

**❓ Widget menampilkan "Saldo cloud belum diatur"**
- Itu normal kalau Bagian 6.4 belum dilakukan. Tombol Keluar/Masuk **tetap berfungsi**. Ikuti 6.4 untuk saldo live.

**❓ Widget saldo "Gagal memuat (HTTP 401/403)"**
- WIDGET_TOKEN di GitHub Secrets belum sama dengan yang di aplikasi. Salin ulang dari Pengaturan → Widget Android → perbarui secret → jalankan ulang workflow.

**❓ Sync error "relation does not exist"**
- SQL schema belum dijalankan / belum lengkap. Ulangi Langkah 5.2 (pastikan sampai baris paling bawah dijalankan).

**❓ Kode email Supabase tidak datang**
- Cek folder Spam. Tunggu ± 1 menit. Pastikan email benar. Free tier Supabase membatasi 2 email/jam untuk OTP — kalau kena limit, coba lagi nanti.

**❓ Lupa/ingin ganti akun cloud**
- Pengaturan → Sinkronisasi Cloud → **Keluar Cloud** → login ulang dengan email lain.

**❓ Aku ingin ubah tampilan/kategori/ikon**
- Kategori & dompet: atur sendiri di aplikasi (Menu → Kategori / Dompet). Ikon & warna bisa diganti.
- Perubahan desain besar: minta aku saja 😄

---

<a name="bagian-9"></a>
## Bagian 9 — Jalankan Project di Komputer Sendiri (Opsional) 🖥️

Mau mencoba aplikasinya di laptop/PC (bukan lewat Vercel)? Bisa. Semua perintah di bawah **jalan di Windows, Mac, maupun Linux** — tinggal ketik di CMD/Terminal di dalam folder project.

### Langkah 9.1 — Pasang Node.js (sekali saja)
1. Buka **https://nodejs.org** → unduh versi **LTS** (tombol hijau) → install seperti aplikasi biasa (next-next selesai).
2. Buka **CMD** (Windows: tekan Start, ketik `cmd`) → ketik `node -v` → harus muncul nomor versi (misal `v22.x.x`). ✅

### Langkah 9.2 — Pasang dependensi (sekali saja)
1. Buka folder project (misal `C:\Users\kira\Documents\Website\Budgeto-v2-source`).
2. Klik alamat folder di File Explorer → ketik `cmd` → Enter (CMD terbuka langsung di folder itu).
3. Ketik:
```
npm install
```
4. Tunggu ± 1–2 menit sampai selesai (abaikan warning kuning, yang penting tidak ada kata `error`).

### Langkah 9.3 — Mode uji coba (auto-refresh saat file berubah)
```
npm run dev
```
Buka **http://localhost:3000** di browser. Selesai — ini mode pengembang, paling cepat untuk mencoba.

### Langkah 9.4 — Mode produksi (persis seperti hasil deploy)
```
npm run build
npm start
```
- `npm run build` membuat folder **`out/`** — inilah file situs jadi yang di-upload Vercel.
- `npm start` membuka preview hasil build di **http://localhost:3000**.
- Kalau diminta izin firewall Node.js saat `npm start`, pilih **Allow**.

> 💡 Sebenarnya untuk deploy ke Vercel kamu **tidak perlu** langkah 9 sama sekali — Vercel mem-build otomatis dari GitHub. Bagian ini hanya kalau mau coba di komputer sendiri.

---

## 🧾 Daftar Isi Project (referensi)

```
├── src/                    # Kode aplikasi (Next.js)
│   ├── app/                # Halaman & tema
│   ├── components/budgeto/ # Semua tampilan (dashboard, laporan, dst)
│   └── lib/                # Database, sync, notifikasi, format
├── public/                 # Ikon PWA & manifest
│   └── sw.js               # Service worker (offline + pengingat)
├── android/                # Project APK + widget (siap build)
├── .github/workflows/      # Mesin auto-build APK (GitHub Actions)
├── supabase-schema.sql     # SQL setup database cloud
├── capacitor.config.ts     # Konfigurasi wrapper APK
└── PANDUAN.md              # File yang sedang kamu baca
```

Selamat mencatat keuangan! 💚 — *Budgeto v2*
