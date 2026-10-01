// ============================================================
// BUDGETO v2 — Pengaturan
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSettings } from "@/lib/settings";
import { exportData, downloadJson, importData, resetAllData, toCsv } from "@/lib/repo";
import { getWidgetToken } from "@/lib/sync";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { sendOtp, verifyOtp, signOutCloud, checkAuthState, syncNow, getSyncState, onSyncChange } from "@/lib/sync";
import { requestPermission } from "@/lib/notifications";
import { Card, SectionTitle } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Moon, Sun, Monitor, Download, Upload, Trash2, Cloud, LogIn, LogOut, RefreshCw, BellRing, Share2, Smartphone, ChevronLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "./use-hydrated";

export function SettingsView({ onBack }: { onBack: () => void }) {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<{ state: string; message: string }>({ state: "unconfigured", message: "" });
  const [syncing, setSyncing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importText, setImportText] = useState("");

  const txCount = useLiveQuery(async () => {
    const all = await db.transactions.toArray();
    return all.filter((t) => !t.deleted).length;
  }, []);

  useEffect(() => {
    void checkAuthState().then(setLoggedInEmail);
    const un = onSyncChange((state, message) => setSyncState({ state, message }));
    return un;
  }, []);

  async function handleExport() {
    const json = await exportData();
    downloadJson(`budgeto-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
    toast.success("Backup JSON diunduh");
  }

  async function handleExportCsv() {
    const [txs, cats] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]);
    const csv = toCsv(txs, cats);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budgeto-transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV diunduh (bisa dibuka di Excel/Sheets)");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await importData(text);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={onBack} aria-label="Kembali">
          <ChevronLeft size={20} />
        </Button>
        <div>
          <h1 className="text-base font-bold leading-tight">Pengaturan</h1>
          <p className="text-xs text-muted-foreground">{txCount ?? "…"} transaksi tersimpan di perangkat ini</p>
        </div>
      </div>

      {/* Tampilan */}
      <section>
        <SectionTitle title="Tampilan" />
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              {mounted && theme === "dark" ? <Moon size={15} /> : mounted && theme === "light" ? <Sun size={15} /> : <Monitor size={15} />}
              Tema
            </div>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-all", mounted && theme === t ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
                >
                  {t === "light" && <Sun size={12} />}
                  {t === "dark" && <Moon size={12} />}
                  {t === "system" && <Monitor size={12} />}
                  {t === "light" ? "Terang" : t === "dark" ? "Gelap" : "Auto"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="nama">Nama kamu</label>
            <Input id="nama" value={settings.userName} onChange={(e) => settings.set("userName", e.target.value)} placeholder="misal: Avo" className="h-8 w-40 rounded-lg text-sm" maxLength={30} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="cur">Mata uang</label>
            <select
              id="cur"
              value={settings.currency}
              onChange={(e) => settings.set("currency", e.target.value)}
              className="h-8 rounded-lg border bg-background px-2 text-sm outline-none"
            >
              <option value="IDR">Rupiah (Rp)</option>
              <option value="USD">Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="SGD">Singapore $</option>
              <option value="MYR">Ringgit (RM)</option>
              <option value="JPY">Yen (¥)</option>
            </select>
          </div>
        </Card>
      </section>

      {/* Notifikasi */}
      <section>
        <SectionTitle title="Notifikasi" />
        <Card className="space-y-3">
          <SettingToggle
            icon={BellRing}
            title="Izinkan notifikasi HP"
            subtitle={typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" ? "Sudah aktif ✓" : "Klik untuk minta izin ke HP"}
            checked={settings.notificationsEnabled && (typeof window === "undefined" || !("Notification" in window) || Notification.permission === "granted")}
            onToggle={async () => {
              if (!settings.notificationsEnabled) {
                settings.set("notificationsEnabled", true);
                const p = await requestPermission();
                if (p === "granted") toast.success("Notifikasi aktif!");
                else toast.warning("Izin notifikasi belum diberikan. Cek pengaturan browser.");
              } else {
                settings.set("notificationsEnabled", false);
              }
            }}
          />
          <SettingToggle
            title="Notif tiap transaksi dicatat"
            subtitle="Konfirmasi setiap kali kamu simpan pemasukan/pengeluaran"
            checked={settings.txNotif}
            onToggle={() => settings.set("txNotif", !settings.txNotif)}
          />
          <SettingToggle
            title="Peringatan budget"
            subtitle="Bunyi saat budget terpakai 80% & 100%"
            checked={settings.budgetAlerts}
            onToggle={() => settings.set("budgetAlerts", !settings.budgetAlerts)}
          />
          <SettingToggle
            title="Pengingat harian"
            subtitle="Ingatkan kalau belum catat keuangan hari ini"
            checked={settings.dailyReminder}
            onToggle={() => settings.set("dailyReminder", !settings.dailyReminder)}
          />
          {settings.dailyReminder && (
            <div className="flex items-center justify-between pl-1">
              <span className="text-xs text-muted-foreground">Jam pengingat</span>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => settings.set("reminderTime", e.target.value)}
                className="h-8 rounded-lg border bg-background px-2 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          )}
        </Card>
      </section>

      {/* Cloud sync */}
      <section>
        <SectionTitle title="Sinkronisasi Cloud (Opsional)" />
        <Card className="space-y-3">
          {loggedInEmail ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium"><Cloud size={15} className="text-primary" /> Aktif — {loggedInEmail}</div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Status: {syncState.state === "ok" ? "tersinkron ✓" : syncState.state === "syncing" ? "sedang sinkron..." : syncState.state === "error" ? syncState.message || "error" : syncState.state === "offline" ? "offline" : "siap"}</span>
                <button
                  className="flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-muted"
                  onClick={async () => { setSyncing(true); const r = await syncNow(); toast[r.ok ? "success" : "error"](r.message); setSyncing(false); }}
                >
                  <RefreshCw size={11} className={syncing ? "animate-spin" : ""} /> Sinkron sekarang
                </button>
              </div>
              <SettingToggle title="Auto-sync" subtitle="Sinkron otomatis tiap ada perubahan" checked={settings.cloudAutoSync} onToggle={() => settings.set("cloudAutoSync", !settings.cloudAutoSync)} />
              <Button variant="outline" className="h-9 w-full rounded-xl text-sm" onClick={async () => { await signOutCloud(); setLoggedInEmail(null); toast.success("Keluar dari cloud"); }}>
                <LogOut size={14} className="mr-1" /> Keluar Cloud
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-medium"><LogIn size={15} className="text-primary" /> Hubungkan akun cloud</div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Data tetap tersimpan di HP walau tanpa cloud. Kalau dihubungkan, data ikut ter-backup otomatis & bisa dibuka dari HP lain. Gratis pakai Supabase — ikuti langkah di panduan.
              </p>
              <Input value={settings.supabaseUrl} onChange={(e) => settings.set("supabaseUrl", e.target.value)} placeholder="Supabase Project URL (https://xxx.supabase.co)" className="h-9 rounded-xl text-xs" />
              <Input value={settings.supabaseAnonKey} onChange={(e) => settings.set("supabaseAnonKey", e.target.value)} placeholder="Supabase anon/public key (eyJhb...)" className="h-9 rounded-xl text-xs" />
              {!otpSent ? (
                <Button className="h-9 w-full rounded-xl text-sm" onClick={async () => {
                  if (!settings.supabaseUrl || !settings.supabaseAnonKey) { toast.error("Isi URL & anon key dulu"); return; }
                  if (!email.includes("@")) { toast.error("Isi email yang valid"); return; }
                  const r = await sendOtp(email);
                  if (r.ok) { setOtpSent(true); toast.success(r.message); }
                  else toast.error(r.message);
                }}>Kirim Kode ke Email</Button>
              ) : (
                <>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Kode 6 digit dari email" className="h-9 rounded-xl text-center text-sm tracking-[0.4em]" maxLength={6} />
                  <Button className="h-9 w-full rounded-xl text-sm" onClick={async () => {
                    const r = await verifyOtp(email, otp);
                    if (r.ok) { setLoggedInEmail(email); setOtpSent(false); toast.success(r.message); }
                    else toast.error(r.message);
                  }}>Verifikasi & Masuk</Button>
                </>
              )}
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email kamu" type="email" className="h-9 rounded-xl text-sm" />
            </>
          )}
        </Card>
      </section>

      {/* Data */}
      <section>
        <SectionTitle title="Data & Backup" />
        <Card className="space-y-2">
          <button className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-accent" onClick={handleExport}>
            <Download size={16} className="text-primary" />
            <div>
              <p className="text-sm font-medium">Backup data (JSON)</p>
              <p className="text-[11px] text-muted-foreground">Simpan semua data ke file — bisa dipulihkan kapan saja</p>
            </div>
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-accent" onClick={handleExportCsv}>
            <Download size={16} className="text-primary" />
            <div>
              <p className="text-sm font-medium">Ekspor ke Excel/CSV</p>
              <p className="text-[11px] text-muted-foreground">Semua transaksi dalam format CSV</p>
            </div>
          </button>
          <label className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-accent">
            <Upload size={16} className="text-primary" />
            <div>
              <p className="text-sm font-medium">Pulihkan dari backup</p>
              <p className="text-[11px] text-muted-foreground">Pilih file JSON backup Budgeto</p>
            </div>
            <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </label>
          <button className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-accent" onClick={() => setConfirmReset(true)}>
            <Trash2 size={16} className="text-expense" />
            <div>
              <p className="text-sm font-medium text-expense">Hapus semua data</p>
              <p className="text-[11px] text-muted-foreground">Mulai dari nol — pastikan sudah backup!</p>
            </div>
          </button>
        </Card>
      </section>

      {/* Widget Android */}
      <section>
        <SectionTitle title="Widget Android" />
        <Card className="space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Widget layar utama tersedia di <b>APK Android</b> (lihat panduan &quot;Widget &amp; APK&quot;).
            Agar widget bisa menampilkan <b>saldo live</b>, masukkan 3 nilai ini ke GitHub <b>Secrets</b> (SUPABASE_URL, SUPABASE_ANON_KEY, WIDGET_TOKEN):
          </p>
          {loggedInEmail ? (
            <>
              <CopyRow label="WIDGET_TOKEN" getValue={async () => (await getWidgetToken()) ?? "Buka app dulu & tekan Sinkron sekarang"} />
              <CopyRow label="SUPABASE_URL" getValue={async () => settings.supabaseUrl} />
              <CopyRow label="SUPABASE_ANON_KEY" getValue={async () => settings.supabaseAnonKey} />
            </>
          ) : (
            <p className="rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
              Hubungkan cloud dulu (di atas), lalu tekan &quot;Sinkron sekarang&quot; — token widget akan dibuat otomatis.
            </p>
          )}
        </Card>
      </section>

      {/* Pasang aplikasi */}
      <section>
        <SectionTitle title="Pasang Aplikasi" />
        <Card className="space-y-2">
          <div className="flex gap-3 px-1 py-1.5">
            <Smartphone size={16} className="mt-0.5 shrink-0 text-primary" />
            <div className="text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 text-sm font-medium text-foreground">Android (Chrome)</p>
              Menu ⋮ → <b>Tambahkan ke layar utama</b>. Aplikasi muncul seperti app biasa, bisa dibuka tanpa browser.
              <p className="mb-0.5 mt-2 text-sm font-medium text-foreground">iPhone (Safari)</p>
              Tombol Share → <b>Add to Home Screen</b>.
              <p className="mt-2">Ingin <b>widget layar utama + APK</b>? Ikuti bagian &quot;Widget & APK&quot; di panduan (PANDUAN.md).</p>
            </div>
          </div>
        </Card>
      </section>

      {/* Tentang */}
      <section className="pb-2">
        <Card className="flex items-start gap-3">
          <Info size={16} className="mt-0.5 shrink-0 text-primary" />
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">Budgeto v2.0</p>
            <p>Catatan keuangan pribadi — 100% gratis, tanpa iklan, tanpa akun wajib. Data finansialmu tersimpan di perangkatmu sendiri (offline-first). Dibuat dengan ❤️ oleh {settings.userName || "kamu"} & Budgeto.</p>
          </div>
        </Card>
      </section>

      {/* Konfirmasi reset */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Trash2 size={15} className="text-expense" /> Hapus SEMUA data?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Semua transaksi, dompet, budget, dan target akan dihapus permanen dari perangkat ini. Pastikan kamu sudah backup atau tersinkron ke cloud.</p>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setConfirmReset(false)}>Batal</Button>
            <Button variant="destructive" className="h-9 flex-1 rounded-xl" onClick={async () => {
              await resetAllData();
              setConfirmReset(false);
              toast.success("Semua data dihapus. Mulai dari nol!");
            }}>Ya, hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingToggle({ icon: Icon, title, subtitle, checked, onToggle }: {
  icon?: typeof BellRing; title: string; subtitle: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {Icon && <Icon size={15} className="mt-0.5 shrink-0 text-primary" />}
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} aria-label={title} />
    </div>
  );
}

function CopyRow({ label, getValue }: { label: string; getValue: () => Promise<string> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-[11px]">{label === "WIDGET_TOKEN" ? "••••••••-••••-•••• (tekan salin)" : "disimpan di pengaturan ini"}</p>
      </div>
      <button
        className="shrink-0 rounded-lg border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
        onClick={async () => {
          try {
            const v = await getValue();
            await navigator.clipboard.writeText(v);
            setCopied(true);
            toast.success(`${label} disalin`);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Gagal menyalin — salin manual dari pengaturan");
          }
        }}
      >
        {copied ? "✓" : "Salin"}
      </button>
    </div>
  );
}
