// ============================================================
// BUDGETO v3 — Pengaturan
// Tampilan (mode + 6 preset aksen, F03), Bahasa (F09), Periode &
// tanggal gajian (F05, dengan pratinjau + peringatan), Keamanan
// (PIN & privasi, F07), Notifikasi, Data & backup (JSON/CSV),
// Sinkron cloud opsional, Zona berbahaya.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useLang } from "@/lib/i18n";
import { useLock, hashPin, verifyPin } from "@/lib/lock";
import { saveWallet, exportData, importData, downloadFile, toCsv, resetAllData } from "@/lib/repo";
import { db } from "@/lib/db";
import { pushWidgetSnapshot } from "@/lib/widget";
import { sendOtp, verifyOtp, signOutCloud, getSessionEmail, syncNow, getSyncState, onSyncChange } from "@/lib/sync";
import { currentPeriod, periodLabel } from "@/lib/period";
import { ACCENT_PRESETS, PALETTE } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, Segmented, IconBubble } from "./ui-bits";
import { requestPermission, notify } from "@/lib/notifications";
import { ArrowLeft, Sun, Moon, Monitor, Palette, Languages, CalendarDays, ShieldCheck, Bell, DatabaseBackup, CloudUpload, TriangleAlert, Check, Loader2, CloudOff, Info } from "lucide-react";
import { toast } from "sonner";

export function SettingsView({ onBack }: { onBack: () => void }) {
  const s = useSettings();
  const set = useSettings((x) => x.set);
  const lang = useLang((x) => sLangOf(x.lang));
  const t = useLang((x) => x);
  const [email, setEmail] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncInfo, setSyncInfo] = useState(getSyncState());
  const fileRef = useRef<HTMLInputElement>(null);

  const dict = t.lang === "en" ? enDict() : idDict();

  useEffect(() => { void getSessionEmail().then(setEmail); }, []);
  useEffect(() => onSyncChange((state, message) => setSyncInfo({ state, message: message ?? "" })), []);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-start gap-2.5 pb-1">
        <button onClick={onBack} aria-label="Kembali" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border">
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{dict.settings}</h1>
          <p className="text-[11px] text-muted-foreground">Budgeto v3</p>
        </div>
      </div>

      {/* ── Tampilan ── */}
      <Section icon={<Palette size={15} />} title={dict.appearance}>
        <div className="space-y-3 p-4">
          <div>
            <p className="pb-1.5 text-[11px] font-bold text-muted-foreground">{dict.themeMode}</p>
            <Segmented
              value={s.themeMode}
              onChange={(v) => { set("themeMode", v); setTimeout(() => void pushWidgetSnapshot(), 60); }}
              options={[
                { value: "system", label: dict.system },
                { value: "light", label: dict.light },
                { value: "dark", label: dict.dark },
              ]}
            />
          </div>
          <div>
            <p className="pb-1.5 text-[11px] font-bold text-muted-foreground">{dict.accent}</p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set("accent", p.id)}
                  aria-pressed={s.accent === p.id}
                  aria-label={p.label}
                  className={cn("flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[11px] font-bold transition-all",
                    s.accent === p.id ? "bg-primary/12 text-primary ring-1 ring-primary/40" : "bg-surface2 text-muted-foreground")}
                >
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.swatch }} />
                  {p.label}
                  {s.accent === p.id && <Check size={11} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Bahasa ── */}
      <Section icon={<Languages size={15} />} title={dict.language}>
        <div className="p-4">
          <Segmented
            value={s.lang}
            onChange={(v) => { set("lang", v); t.setLang(v); setTimeout(() => void pushWidgetSnapshot(), 60); }}
            options={[
              { value: "id", label: "Bahasa Indonesia" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
      </Section>

      {/* ── Periode & gajian ── */}
      <Section icon={<CalendarDays size={15} />} title={dict.periodPayday}>
        <div className="space-y-3 p-4">
          <div>
            <p className="pb-1.5 text-[11px] font-bold text-muted-foreground">{dict.periodMode}</p>
            <Segmented
              value={s.periodMode}
              onChange={(v) => set("periodMode", v)}
              options={[
                { value: "payday", label: dict.paydayMode },
                { value: "calendar", label: dict.calendarMode },
              ]}
            />
          </div>
          {s.periodMode === "payday" && (
            <label className="block">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{dict.paydayDay}</span>
              <input
                inputMode="numeric"
                value={s.payday}
                onChange={(e) => set("payday", Math.min(31, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
                className="w-24 rounded-xl bg-surface2 px-3 py-2.5 text-sm font-extrabold outline-none ring-1 ring-border"
              />
            </label>
          )}
          <div className="rounded-xl bg-primary/8 p-3">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">{dict.periodPreview}</p>
            <p className="text-xs font-extrabold text-primary">{periodLabel(currentPeriod(s.periodMode, s.payday), s.lang)}</p>
          </div>
          <p className="flex items-start gap-1.5 rounded-xl bg-warn/10 p-2.5 text-[10px] leading-relaxed text-warn">
            <Info size={12} className="mt-0.5 shrink-0" />
            {dict.periodChangeWarn}
          </p>
        </div>
      </Section>

      {/* ── Keamanan & privasi ── */}
      <SecuritySection dict={dict} />

      {/* ── Notifikasi ── */}
      <Section icon={<Bell size={15} />} title={dict.notifications}>
        <div className="space-y-2 p-4">
          <Toggle label={dict.notifEnabled} checked={s.notificationsEnabled} onChange={(v) => { set("notificationsEnabled", v); if (v) void requestPermission(); }} />
          <Toggle label={dict.notifTx} checked={s.txNotif} onChange={(v) => set("txNotif", v)} disabled={!s.notificationsEnabled} />
          <Toggle label={dict.notifBudget} checked={s.budgetAlerts} onChange={(v) => set("budgetAlerts", v)} disabled={!s.notificationsEnabled} />
          <Toggle label={dict.notifDaily} checked={s.dailyReminder} onChange={(v) => set("dailyReminder", v)} disabled={!s.notificationsEnabled} />
          {s.dailyReminder && (
            <label className="flex items-center justify-between pl-1">
              <span className="text-xs font-semibold">{dict.reminderTime}</span>
              <input type="time" value={s.reminderTime} onChange={(e) => set("reminderTime", e.target.value)} className="rounded-xl bg-surface2 px-3 py-2 text-xs font-bold outline-none" />
            </label>
          )}
          <Toggle label={dict.notifBills} checked={s.billReminders} onChange={(v) => set("billReminders", v)} disabled={!s.notificationsEnabled} />
        </div>
      </Section>

      {/* ── Data & backup ── */}
      <Section icon={<DatabaseBackup size={15} />} title={dict.dataBackup}>
        <div className="space-y-2.5 p-4">
          <p className="rounded-xl bg-surface2 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
            {dict.backupHint} {dict.lastBackup}: {s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleString(s.lang === "id" ? "id-ID" : "en-US") : dict.never}
          </p>
          <ActionRow
            label={dict.exportJson}
            onClick={async () => {
              const json = await exportData();
              downloadFile(`budgeto-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
              set("lastBackupAt", Date.now());
              toast.success("Backup diunduh ✓");
            }}
          />
          <ActionRow
            label={dict.exportCsv}
            onClick={async () => {
              const [txs, cats, wallets] = await Promise.all([db.transactions.toArray(), db.categories.toArray(), db.wallets.toArray()]);
              downloadFile(`budgeto-transaksi-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(txs, cats, wallets), "text/csv");
            }}
          />
          <ActionRow label={dict.importJson} onClick={() => fileRef.current?.click()} />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const res = await importData(text, "merge");
              if (res.ok) {
                set("lastBackupAt", Date.now());
                toast.success(res.message);
              } else toast.error(res.message);
              e.target.value = "";
            }}
          />
          <p className="text-[10px] leading-relaxed text-muted-foreground">{dict.importMerge}</p>
        </div>
      </Section>

      {/* ── Cloud opsional ── */}
      <Section icon={<CloudUpload size={15} />} title={dict.cloud}>
        <div className="space-y-2.5 p-4">
          <p className="text-[10px] leading-relaxed text-muted-foreground">{dict.cloudDesc}</p>
          <label className="block">
            <span className="pb-1 block text-[10px] font-bold text-muted-foreground uppercase">{dict.supabaseUrl}</span>
            <input value={s.supabaseUrl} onChange={(e) => set("supabaseUrl", e.target.value)} placeholder="https://xxxx.supabase.co" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-xs outline-none ring-1 ring-border" />
          </label>
          <label className="block">
            <span className="pb-1 block text-[10px] font-bold text-muted-foreground uppercase">{dict.supabaseKey}</span>
            <input value={s.supabaseAnonKey} onChange={(e) => set("supabaseAnonKey", e.target.value)} type="password" placeholder="eyJhbGciOi…" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-xs outline-none ring-1 ring-border" />
          </label>
          <Toggle label={dict.autoSync} checked={s.cloudAutoSync} onChange={(v) => set("cloudAutoSync", v)} />

          {email ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 rounded-xl bg-ok/10 p-2.5 text-[11px] font-bold text-ok">
                <Check size={13} /> {email}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => { setBusy(true); const r = await syncNow(); if (r.ok) toast.success(r.message); else toast.error(r.message); setBusy(false); }}
                  className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold"
                >
                  {busy ? <Loader2 size={13} className="mx-auto animate-spin" /> : dict.syncNow}
                </button>
                <button onClick={() => void signOutCloud().then(() => setEmail(null))} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-bad">
                  {dict.signOut}
                </button>
              </div>
            </div>
          ) : (
            <CloudLogin dict={dict} onDone={setEmail} otpSent={otpSent} setOtpSent={setOtpSent} />
          )}

          {syncInfo.state === "error" && (
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-bad"><CloudOff size={11} /> {syncInfo.message}</p>
          )}
        </div>
      </Section>

      {/* ── Zona berbahaya ── */}
      <Section icon={<TriangleAlert size={15} />} title={dict.danger} danger>
        <div className="space-y-2 p-4">
          <p className="text-[10px] leading-relaxed text-muted-foreground">{dict.resetAllDesc}</p>
          <button
            onClick={async () => {
              const phrase = prompt(dict.typeErase);
              if (phrase?.trim().toUpperCase() === "HAPUS" || phrase?.trim().toUpperCase() === "ERASE") {
                await resetAllData();
                toast.success("✓");
              } else if (phrase !== null) toast.error(dict.wrongPin);
            }}
            className="w-full rounded-xl bg-bad/10 py-2.5 text-xs font-extrabold text-bad ring-1 ring-bad/30"
          >
            {dict.resetAll}
          </button>
        </div>
      </Section>

      <p className="pb-2 text-center text-[10px] text-muted-foreground">Budgeto v3.0 · offline-first · Dexie + Next.js</p>
    </div>
  );
}

function sLangOf(l: "id" | "en"): "id" | "en" { return l; }
function idDict() { return DICT_ID; }
function enDict() { return DICT_EN; }

// kamus lokal ringkas (hindari import melingkar dengan i18n)
const DICT_ID = {
  settings: "Pengaturan", appearance: "Tampilan", themeMode: "Mode", system: "Ikut sistem", light: "Terang", dark: "Gelap",
  accent: "Warna aksen", language: "Bahasa", periodPayday: "Periode & tanggal gajian", periodMode: "Aturan periode",
  calendarMode: "Bulan kalender", paydayMode: "Tanggal gajian", paydayDay: "Tanggal gajian (1–31)",
  periodPreview: "Periode sekarang", periodChangeWarn: "Mengubah aturan periode akan menghitung ulang dashboard, budget, dan laporan. Angka laporan lama bisa berubah.",
  security: "Keamanan & privasi", appLock: "Kunci aplikasi (PIN)", appLockDesc: "Minta PIN saat app dibuka / kembali dari latar belakang",
  autoLock: "Kunci ulang setelah", immediately: "Langsung", min1: "1 menit", min5: "5 menit",
  privacyMode: "Mode privasi", privacyModeDesc: "Sembunyikan angka di dashboard & widget",
  forgotPin: "Lupa PIN?", forgotPinDesc: "Satu-satunya cara pulih adalah menghapus semua data app (PIN ikut hilang). Backup dulu jika masih ada data penting.",
  resetPinData: "Hapus PIN & semua data", typeErase: "Ketik HAPUS untuk konfirmasi",
  biometric: "Biometrik (segera di APK)", biometricSoon: "Tersedia di build APK berikutnya",
  enterPin: "Buat PIN 4–6 digit", confirmPin: "Ulangi PIN", pinMismatch: "PIN tidak sama",
  notifications: "Notifikasi", notifEnabled: "Notifikasi aktif", notifTx: "Catat transaksi", notifBudget: "Peringatan budget 80% & 100%",
  notifDaily: "Pengingat catat harian", reminderTime: "Jam pengingat", notifBills: "Pengingat tagihan",
  dataBackup: "Data & backup", exportJson: "Ekspor backup (JSON)", exportCsv: "Ekspor transaksi (CSV)",
  importJson: "Impor backup (JSON)", importMerge: "Impor menggabungkan: data dengan id sama ditimpa dari file, data lain tetap.",
  lastBackup: "Backup terakhir", never: "belum pernah", backupHint: "Data hanya ada di perangkat ini. Ekspor backup secara berkala.",
  cloud: "Sinkron cloud (opsional)", cloudDesc: "Sinkron antar perangkat via Supabase. App tetap jalan penuh tanpa ini.",
  supabaseUrl: "URL Supabase", supabaseKey: "Anon key", email: "Email", sendOtp: "Kirim kode OTP",
  otpCode: "Kode OTP (6 digit)", verify: "Verifikasi", signOut: "Keluar", autoSync: "Sinkron otomatis", syncNow: "Sinkron sekarang",
  danger: "Zona berbahaya", resetAll: "Hapus semua data", resetAllDesc: "Semua transaksi, budget, dompet, dan aturan dihapus dari perangkat.",
  wrongPin: "Konfirmasi tidak cocok",
};

const DICT_EN: typeof DICT_ID = {
  settings: "Settings", appearance: "Appearance", themeMode: "Mode", system: "System", light: "Light", dark: "Dark",
  accent: "Accent color", language: "Language", periodPayday: "Period & payday", periodMode: "Period rule",
  calendarMode: "Calendar month", paydayMode: "Payday date", paydayDay: "Payday (1–31)",
  periodPreview: "Current period", periodChangeWarn: "Changing the period rule recalculates dashboard, budgets, and reports. Past numbers may change.",
  security: "Security & privacy", appLock: "App lock (PIN)", appLockDesc: "Require PIN when opening or returning to the app",
  autoLock: "Re-lock after", immediately: "Immediately", min1: "1 minute", min5: "5 minutes",
  privacyMode: "Privacy mode", privacyModeDesc: "Hide numbers on dashboard & widget",
  forgotPin: "Forgot PIN?", forgotPinDesc: "The only way to recover is erasing all app data (PIN included). Make a backup first.",
  resetPinData: "Erase PIN & all data", typeErase: "Type ERASE to confirm",
  biometric: "Biometric (coming to APK)", biometricSoon: "Available in the next APK build",
  enterPin: "Create a 4–6 digit PIN", confirmPin: "Repeat PIN", pinMismatch: "PINs do not match",
  notifications: "Notifications", notifEnabled: "Notifications on", notifTx: "Transaction recorded", notifBudget: "Budget alerts 80% & 100%",
  notifDaily: "Daily logging reminder", reminderTime: "Reminder time", notifBills: "Bill reminders",
  dataBackup: "Data & backup", exportJson: "Export backup (JSON)", exportCsv: "Export transactions (CSV)",
  importJson: "Import backup (JSON)", importMerge: "Import merges: rows with the same id are overwritten from the file; others are kept.",
  lastBackup: "Last backup", never: "never", backupHint: "Data lives only on this device. Export a backup regularly.",
  cloud: "Cloud sync (optional)", cloudDesc: "Sync across devices via Supabase. The app works fully without it.",
  supabaseUrl: "Supabase URL", supabaseKey: "Anon key", email: "Email", sendOtp: "Send OTP code",
  otpCode: "OTP code (6 digits)", verify: "Verify", signOut: "Sign out", autoSync: "Auto sync", syncNow: "Sync now",
  danger: "Danger zone", resetAll: "Erase all data", resetAllDesc: "All transactions, budgets, wallets, and rules are removed from this device.",
  wrongPin: "Confirmation does not match",
};

function Section({ icon, title, children, danger }: { icon: React.ReactNode; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section>
      <p className={cn("flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide", danger ? "text-bad" : "text-muted-foreground")}>
        {icon} {title}
      </p>
      <Card className={danger ? "border-bad/30" : undefined}>{children}</Card>
    </section>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      className={cn("flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left", disabled && "opacity-40")}
      disabled={disabled}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-primary" : "bg-border")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function ActionRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl bg-surface2 py-2.5 text-left px-3 text-xs font-bold text-foreground transition-colors hover:bg-border/50">
      {label}
    </button>
  );
}

function CloudLogin({ dict, onDone, otpSent, setOtpSent }: {
  dict: typeof DICT_ID; onDone: (email: string) => void; otpSent: boolean; setOtpSent: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  if (!otpSent) {
    return (
      <button
        disabled={!email.includes("@") || busy}
        onClick={async () => { setBusy(true); const r = await sendOtp(email); if (r.ok) { toast.success(r.message); setOtpSent(true); } else toast.error(r.message); setBusy(false); }}
        className="w-full rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="mx-auto animate-spin" /> : dict.sendOtp}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <input value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={dict.otpCode} inputMode="numeric" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-center text-sm font-extrabold tracking-[0.3em] outline-none ring-1 ring-border" />
      <button
        disabled={token.length < 6 || busy}
        onClick={async () => { setBusy(true); const r = await verifyOtp(email, token); if (r.ok) { toast.success(r.message); onDone(email); } else toast.error(r.message); setBusy(false); }}
        className="w-full rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="mx-auto animate-spin" /> : dict.verify}
      </button>
    </div>
  );
}

// ─── Keamanan: PIN setup / remove, auto-lock, privasi, biometrik flag ──
function SecuritySection({ dict }: { dict: typeof DICT_ID }) {
  const s = useSettings();
  const set = useSettings((x) => x.set);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Section icon={<ShieldCheck size={15} />} title={dict.security}>
      <div className="space-y-2.5 p-4">
        <Toggle label={dict.appLock} checked={s.lockEnabled} onChange={(v) => { set("lockEnabled", v); if (v) setShowSetup(true); else { set("pin", null); setShowSetup(false); } }} />
        {s.lockEnabled && showSetup && (
          <div className="anim-rise space-y-2 rounded-xl bg-surface2 p-3">
            <input
              value={pin1}
              onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={dict.enterPin}
              inputMode="numeric"
              type="password"
              className="w-full rounded-xl bg-card px-3 py-2.5 text-center text-sm font-extrabold tracking-[0.35em] outline-none ring-1 ring-border"
            />
            <input
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={dict.confirmPin}
              inputMode="numeric"
              type="password"
              className="w-full rounded-xl bg-card px-3 py-2.5 text-center text-sm font-extrabold tracking-[0.35em] outline-none ring-1 ring-border"
            />
            <button
              disabled={pin1.length < 4 || pin1 !== pin2 || busy}
              onClick={async () => {
                setBusy(true);
                const record = await hashPin(pin1);
                set("pin", record);
                setShowSetup(false);
                setPin1(""); setPin2("");
                toast.success("✓");
                setBusy(false);
              }}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="mx-auto animate-spin" /> : "✓"}
            </button>
            {pin1 !== pin2 && pin2.length > 0 && <p className="text-center text-[10px] font-bold text-bad">{dict.pinMismatch || "PIN tidak sama"}</p>}
          </div>
        )}
        {s.lockEnabled && (
          <>
            <div>
              <p className="pb-1.5 pl-1 text-[11px] font-bold text-muted-foreground">{dict.autoLock}</p>
              <Segmented
                value={String(s.autoLockDelay) as "0" | "60" | "300"}
                onChange={(v) => set("autoLockDelay", Number(v) as 0 | 60 | 300)}
                options={[
                  { value: "0", label: dict.immediately },
                  { value: "60", label: dict.min1 },
                  { value: "300", label: dict.min5 },
                ]}
              />
            </div>
            <button onClick={() => setShowForgot((v) => !v)} className="pl-1 text-[11px] font-bold text-warn underline-offset-2 hover:underline">
              {dict.forgotPin}
            </button>
            {showForgot && (
              <div className="anim-rise space-y-2 rounded-xl bg-bad/8 p-3 ring-1 ring-bad/25">
                <p className="text-[10px] leading-relaxed text-foreground/85">{dict.forgotPinDesc}</p>
                <button
                  onClick={async () => {
                    const phrase = prompt(dict.typeErase);
                    if (phrase?.trim().toUpperCase() === "HAPUS" || phrase?.trim().toUpperCase() === "ERASE") {
                      await resetAllData();
                      set("lockEnabled", false);
                      set("pin", null);
                      useLock.getState().unlock();
                      toast.success("✓");
                    } else if (phrase !== null) toast.error(dict.wrongPin);
                  }}
                  className="w-full rounded-xl bg-bad/15 py-2 text-[11px] font-extrabold text-bad"
                >
                  {dict.resetPinData}
                </button>
              </div>
            )}
          </>
        )}
        <Toggle label={dict.privacyMode} checked={s.privacyMode} onChange={(v) => set("privacyMode", v)} />
        <p className="pl-1 text-[10px] text-muted-foreground">{dict.privacyModeDesc}</p>
        <div className="rounded-xl bg-surface2 p-2.5 opacity-70">
          <p className="text-[11px] font-semibold text-muted-foreground">🔒 {dict.biometric}</p>
          <p className="text-[10px] text-muted-foreground">{dict.biometricSoon}</p>
        </div>
      </div>
    </Section>
  );
}
