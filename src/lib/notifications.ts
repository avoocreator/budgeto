// ============================================================
// BUDGETO v3 — Notifikasi (system via SW + in-app toast)
// - Notifikasi saat transaksi dicatat
// - Peringatan budget 80% / 100% (sekali per level per bulan/periode)
// - Pengingat catat harian
// - Pengingat tagihan H-1 (F06)
// ============================================================

"use client";

import { Capacitor } from "@capacitor/core";

/** True saat berjalan di dalam APK (Capacitor), false di browser/PWA. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// WebView Android TIDAK mendukung Web Notification API / izin notifikasi web,
// jadi di APK notifikasi memakai plugin native @capacitor/local-notifications.
const CHANNEL_ID = "budgeto-default";
const DAILY_REMINDER_ID = 1001;
let channelReady = false;

async function nativePlugin() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  try {
    const ln = await nativePlugin();
    await ln.createChannel({
      id: CHANNEL_ID,
      name: "Budgeto",
      description: "Pengingat, peringatan budget, dan catatan transaksi",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
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

export async function ensureSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return swRegistration;
  } catch {
    return null;
  }
}

/** Tampilkan notifikasi: selalu toast in-app; system notification bila izin ada. */
export async function notify(title: string, body: string, icon = "wallet"): Promise<void> {
  try {
    const { toast } = await import("sonner");
    toast(title, { description: body });
  } catch { /* toast opsional */ }

  if (isNativeApp()) {
    try {
      const ln = await nativePlugin();
      const { display } = await ln.checkPermissions();
      if (display !== "granted") return;
      await ensureChannel();
      await ln.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 2_000_000_000) + 2000, // harus int 32-bit, jangan bentrok dengan 1001
          title,
          body,
          channelId: CHANNEL_ID,
        }],
      });
    } catch { /* notifikasi native gagal — toast sudah muncul */ }
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
export async function diagnoseNotifications(): Promise<string> {
  const out: string[] = [];
  const native = isNativeApp();
  out.push(`native: ${native ? "ya" : "TIDAK"}`);
  if (!native) {
    out.push(`izin web: ${typeof Notification !== "undefined" ? Notification.permission : "n/a"}`);
    return out.join(" | ");
  }
  try {
    const ln = await nativePlugin();
    const before = await ln.checkPermissions();
    out.push(`izin: ${before.display}`);
    if (before.display !== "granted") {
      const r = await ln.requestPermissions();
      out.push(`setelah diminta: ${r.display}`);
      if (r.display !== "granted") return out.join(" | ");
    }
    await ln.createChannel({ id: CHANNEL_ID, name: "Budgeto", importance: 4, visibility: 1, vibration: true });
    out.push("channel: ok");
    await ln.schedule({
      notifications: [{
        id: 1002,
        title: "Tes Budgeto",
        body: "Kalau ini muncul di bar atas HP, notifikasi sudah jalan ✓",
        channelId: CHANNEL_ID,
      }],
    });
    out.push("terkirim ke sistem");
  } catch (e) {
    out.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  }
  return out.join(" | ");
}
