// ============================================================
// BUDGETO v3 — Notifikasi (system via SW + in-app toast)
// - Notifikasi saat transaksi dicatat
// - Peringatan budget 80% / 100% (sekali per level per bulan/periode)
// - Pengingat catat harian
// - Pengingat tagihan H-1 (F06)
// ============================================================

"use client";

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
  if (!enabled || typeof window === "undefined") return;
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
