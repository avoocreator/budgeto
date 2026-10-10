// ============================================================
// BUDGETO v2 — Notifikasi (system + in-app)
// - Notifikasi saat transaksi dicatat
// - Peringatan budget 80% / 100%
// - Pengingat harian (saat app terbuka / periodic background sync)
// ============================================================

"use client";

export const budgetAlertFlags = {
  getFlag(budgetId: string, month: string): number {
    try {
      return Number(localStorage.getItem(`budgeto-ba-${budgetId}-${month}`) ?? 0);
    } catch {
      return 2; // kalau localStorage gagal, jangan spam notif
    }
  },
  setFlag(budgetId: string, month: string, level: number): void {
    try {
      localStorage.setItem(`budgeto-ba-${budgetId}-${month}`, String(level));
    } catch {
      /* ignore */
    }
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

function iconFor(name: string): string {
  return `/icons/notif-${name}.png`;
}

/** Tampilkan notifikasi via service worker (bisa muncul saat app di background). */
export async function notify(title: string, body: string, icon: string = "wallet"): Promise<void> {
  // selalu tampilkan toast in-app
  try {
    const { toast } = await import("sonner");
    toast(title, { description: body });
  } catch {
    /* toast opsional */
  }
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const swReady = await ensureSw();
  try {
    if (swReady) {
      await swReady.showNotification(title, { body, icon: iconFor(icon), badge: iconFor("badge"), tag: `budgeto-${Date.now()}` });
    } else {
      new Notification(title, { body, icon: iconFor(icon) });
    }
  } catch {
    /* notifikasi gagal — abaikan, toast sudah muncul */
  }
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

// ─── Pengingat Harian ────────────────────────────────────────
const REMINDER_KEY = "budgeto-last-reminder";

/**
 * Jadwalkan pengingat harian. Dipanggil setiap app dibuka.
 * Catatan jujur: timer hanya hidup selama app terbuka/berjalan di background.
 * Untuk Android yang ter-install (PWA/API 33+), periodic background sync menambah keandalan.
 */
export function scheduleDailyReminder(time: string, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  const [h, m] = time.split(":").map(Number);
  const nowD = new Date();
  const target = new Date();
  target.setHours(h || 20, m || 0, 0, 0);
  if (target.getTime() <= nowD.getTime()) target.setDate(target.getDate() + 1);
  const delay = target.getTime() - nowD.getTime();
  window.setTimeout(() => {
    void fireDailyReminder();
    // jadwalkan lagi untuk besok
    scheduleDailyReminder(time, enabled);
  }, delay);
}

export async function fireDailyReminder(): Promise<void> {
  if (typeof window === "undefined") return;
  const last = localStorage.getItem(REMINDER_KEY);
  const today = new Date().toISOString().slice(0, 10);
  if (last === today) return; // sudah diingatkan hari ini
  const { db } = await import("./db");
  const todayTx = await db.transactions.where("date").equals(today).toArray();
  const hasExpense = todayTx.some((t) => !t.deleted && t.type === "expense");
  if (hasExpense) return; // sudah catat, tidak perlu diingatkan
  localStorage.setItem(REMINDER_KEY, today);
  void notify("Jangan lupa catat keuangan 💰", "Ada pengeluaran hari ini yang belum dicatat di Budgeto?", "piggy-bank");
}

/** Daftarkan periodic background sync (khusus PWA ter-install di Android Chrome). */
export async function registerPeriodicSync(): Promise<void> {
  const reg = await ensureSw();
  if (!reg) return;
  type PeriodicSyncManager = { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
  const psm = (reg as ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager }).periodicSync;
  if (!psm) return;
  try {
    const status = await navigator.permissions?.query({ name: "periodic-background-sync" as PermissionName });
    if (status?.state === "granted") {
      await psm.register("budgeto-reminder", { minInterval: 12 * 60 * 60 * 1000 });
    }
  } catch {
    /* tidak didukung — abaikan */
  }
}
