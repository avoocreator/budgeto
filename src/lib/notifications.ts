// ============================================================
// BUDGETO v3.1 — Notifikasi (system via SW + in-app toast)
// - Notifikasi saat transaksi dicatat/diubah/dihapus
// - Notifikasi setiap aksi: dompet, goal, budget, kategori, tagihan,
//   backup (notifyAction)
// - Peringatan budget 80% / 100% (sekali per level per bulan/periode)
// - Pengingat catat harian
// - Pengingat tagihan H-1 (F06)
// ============================================================

"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";

/** True saat berjalan di dalam APK (Capacitor), false di browser/PWA. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const LOG_KEY = "budgeto-notif-log";

/** Catatan singkat (8 terakhir) untuk diagnosa — tampil di Pengaturan → Tes notifikasi. */
export function logNotif(msg: string): void {
  try {
    const t = new Date().toTimeString().slice(0, 8);
    const arr: string[] = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
    arr.push(`${t} ${msg}`);
    localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(-8)));
  } catch { /* abaikan */ }
}

export function readNotifLog(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

// WebView Android TIDAK mendukung Web Notification API / izin notifikasi web,
// jadi di APK notifikasi memakai plugin native @capacitor/local-notifications.
const CHANNEL_ID = "budgeto-default";
const DAILY_REMINDER_ID = 1001;
let channelReady = false;

async function nativePlugin() {
  return LocalNotifications;
}

/** Cegah menggantung selamanya bila bridge native tidak merespons. */
function withTimeout<T>(p: Promise<T>, label: string, ms = 6000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`TIMEOUT di langkah: ${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  try {
    const ln = await nativePlugin();
    await withTimeout(ln.createChannel({
      id: CHANNEL_ID,
      name: "Budgeto",
      description: "Pengingat, peringatan budget, dan catatan transaksi",
      importance: 4,
      visibility: 1,
      vibration: true,
    }), "buat channel");
    channelReady = true;
  } catch { /* channel opsional — notifikasi tetap jalan dengan channel default */ }
}

export const budgetAlertFlags = {
  getFlag(budgetId: string, periodKey: string): number {
    try {
      return Number(localStorage.getItem(`budgeto-ba-${budgetId}-${periodKey}`) ?? 0);
    } catch {
      return 2; // kalau localStorage gagal, jangan spam notif
    }
  },
  setFlag(budgetId: string, periodKey: string, level: number): void {
    try {
      localStorage.setItem(`budgeto-ba-${budgetId}-${periodKey}`, String(level));
    } catch { /* abaikan */ }
  },
};

export async function requestPermission(): Promise<NotificationPermission> {
  if (isNativeApp()) {
    try {
      const ln = await nativePlugin();
      let { display } = await ln.checkPermissions();
      // Android 13+: dialog izin sistem muncul di sini (hanya bila belum pernah ditolak 2x)
      if (display === "prompt" || display === "prompt-with-rationale") {
        ({ display } = await ln.requestPermissions());
      }
      if (display === "granted") await ensureChannel();
      return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
    } catch {
      return "denied";
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

let swRegistration: ServiceWorkerRegistration | null = null;

async function cleanupSwInApk(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* abaikan */ }
}

export async function ensureSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  // Di APK aset sudah lokal; service worker hanya menyajikan cache lama yang basi.
  if (isNativeApp()) { void cleanupSwInApk(); return null; }
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return swRegistration;
  } catch {
    return null;
  }
}

/** Tampilkan notifikasi: selalu toast in-app; system notification bila izin ada. */
export async function notify(title: string, body: string, icon = "wallet", opts?: { toast?: boolean }): Promise<void> {
  logNotif(`notify: ${title}`);
  // Toast statis & sinkron — tidak boleh memblokir notifikasi sistem.
  if (opts?.toast !== false) {
    try { toast(title, { description: body }); } catch { /* toast opsional */ }
  }

  if (isNativeApp()) {
    try {
      const { display } = await withTimeout(LocalNotifications.checkPermissions(), "cek izin");
      if (display !== "granted") { logNotif(`dilewati: izin ${display}`); return; }
      await ensureChannel();
      await withTimeout(LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 2_000_000_000) + 2000, // int 32-bit, jangan bentrok dengan 1001/1002
          title,
          body,
          channelId: CHANNEL_ID,
        }],
      }), "kirim notif");
      logNotif("terkirim ke sistem");
    } catch (e) {
      logNotif(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
    return;
  }

  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const sw = await ensureSw();
    const iconUrl = `/icons/notif-${icon}.png`;
    if (sw) {
      await sw.showNotification(title, { body, icon: iconUrl, badge: "/icons/notif-badge.png", tag: `budgeto-${Date.now()}` });
    } else {
      new Notification(title, { body, icon: iconUrl });
    }
  } catch { /* notifikasi gagal — toast sudah muncul */ }
}

// ─── Notifikasi per-aksi (dompet, goal, budget, kategori, tagihan, backup) ──
// Hanya notifikasi sistem di HP (tanpa toast in-app agar UI tidak bising);
// UI sudah punya umpan balik sendiri saat aksi dilakukan.
export async function notifyAction(title: string, body: string, icon = "wallet"): Promise<void> {
  const s = (await import("./settings")).useSettings.getState();
  if (!s.notificationsEnabled || !s.actionNotif) {
    logNotif(`aksi dilewati: aktif=${s.notificationsEnabled} actionNotif=${s.actionNotif}`);
    return;
  }
  await notify(title, body, icon, { toast: false });
}

// ─── Pengingat harian ────────────────────────────────────────
const REMINDER_KEY = "budgeto-last-reminder";

export function scheduleDailyReminder(time: string, enabled: boolean): void {
  if (typeof window === "undefined") return;

  // APK: pakai alarm native berulang — tetap bunyi walau app ditutup
  if (isNativeApp()) {
    void (async () => {
      try {
        const ln = await nativePlugin();
        await ln.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
        if (!enabled) return;
        const { display } = await ln.checkPermissions();
        if (display !== "granted") return;
        await ensureChannel();
        const [h, m] = time.split(":").map(Number);
        await ln.schedule({
          notifications: [{
            id: DAILY_REMINDER_ID,
            title: "Jangan lupa catat keuangan 💰",
            body: "Ada pengeluaran hari ini yang belum dicatat di Budgeto?",
            channelId: CHANNEL_ID,
            schedule: { on: { hour: h || 20, minute: m || 0 }, allowWhileIdle: true },
          }],
        });
      } catch { /* abaikan */ }
    })();
    return;
  }

  if (!enabled) return;
  const [h, m] = time.split(":").map(Number);
  const nowD = new Date();
  const target = new Date();
  target.setHours(h || 20, m || 0, 0, 0);
  if (target.getTime() <= nowD.getTime()) target.setDate(target.getDate() + 1);
  window.setTimeout(() => {
    void fireDailyReminder();
    scheduleDailyReminder(time, enabled);
  }, target.getTime() - nowD.getTime());
}

export async function fireDailyReminder(): Promise<void> {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(REMINDER_KEY) === today) return;
  const { db } = await import("./db");
  const todayTx = await db.transactions.where("date").equals(today).toArray();
  if (todayTx.some((t) => !t.deleted && t.type === "expense")) return;
  localStorage.setItem(REMINDER_KEY, today);
  void notify("Jangan lupa catat keuangan 💰", "Ada pengeluaran hari ini yang belum dicatat di Budgeto?", "piggy-bank");
}

// ─── Diagnosa (tombol "Tes notifikasi" di Pengaturan) ────────
async function runDiagnose(): Promise<string> {
  const out: string[] = [];
  let step = "mulai";
  try {
    const native = isNativeApp();
    out.push(`platform: ${Capacitor.getPlatform()}`);
    out.push(`native: ${native ? "ya" : "TIDAK"}`);
    if (!native) {
      out.push(`izin web: ${typeof Notification !== "undefined" ? Notification.permission : "n/a"}`);
      return out.join(" | ");
    }
    out.push(`plugin: ${Capacitor.isPluginAvailable("LocalNotifications") ? "terdaftar" : "TIDAK TERDAFTAR"}`);

    step = "cek izin";
    const before = await withTimeout(LocalNotifications.checkPermissions(), step);
    out.push(`izin: ${before.display}`);
    if (before.display !== "granted") {
      step = "minta izin";
      const r = await withTimeout(LocalNotifications.requestPermissions(), step, 30000);
      out.push(`setelah diminta: ${r.display}`);
      if (r.display !== "granted") return out.join(" | ");
    }

    step = "buat channel";
    await withTimeout(LocalNotifications.createChannel({ id: CHANNEL_ID, name: "Budgeto", importance: 4, visibility: 1, vibration: true }), step);
    out.push("channel: ok");

    step = "kirim notif";
    await withTimeout(LocalNotifications.schedule({
      notifications: [{
        id: 1002,
        title: "Tes Budgeto",
        body: "Kalau ini muncul di bar atas HP, notifikasi sudah jalan ✓",
        channelId: CHANNEL_ID,
      }],
    }), step);
    out.push("terkirim ke sistem");

    step = "baca daftar tertunda";
    const pending = await withTimeout(LocalNotifications.getPending(), step);
    out.push(`tertunda: ${pending.notifications.length}`);
  } catch (e) {
    out.push(`ERROR (${step}): ${e instanceof Error ? e.message : String(e)}`);
  }
  return out.join(" | ");
}

export async function diagnoseNotifications(): Promise<string> {
  const main = await runDiagnose();
  const log = readNotifLog();
  return `${main} || LOG: ${log.length ? log.join(" ; ") : "(kosong — notify() belum pernah dipanggil)"}`;
}
