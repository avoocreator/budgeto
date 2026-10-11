// ============================================================
// BUDGETO v3 — Transaksi berulang & pengingat tagihan (F06)
// - mode "auto": transaksi dibuat otomatis saat jatuh tempo
// - mode "confirm": masuk daftar "Tagihan menunggu konfirmasi"
// - App lama tidak dibuka → semua jatuh tempo yang terlewat
//   diproses SEKALI, tanpa duplikat (lastPostedDate + iterasi terbatas).
// - Edit aturan hanya berlaku ke depan (transaksi tercatat tak disentuh).
// - Tanggal 29–31 aman: clamp ke hari terakhir bulan.
// ============================================================

import { db, uid } from "./db";
import type { RecurringRule, PendingBill, Transaction } from "./types";
import { todayStr, addDays } from "./format";
import { daysInMonth } from "./format";
import { notify, notifyAction } from "./notifications";
import { useLang } from "./i18n";

/** Jatuh tempo berikutnya setelah `fromDate` (inklusif? — eksklusif: tanggal berikutnya setelah tanggal acuan). */
export function nextOccurrence(rule: RecurringRule, afterDate: string): string {
  const [ay, am, ad] = afterDate.split("-").map(Number);
  if (rule.frequency === "weekly") {
    const weekday = rule.weekday ?? 0;
    const base = new Date(ay, am - 1, ad);
    let delta = (weekday - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(afterDate, delta);
  }
  // monthly — clamp 29-31 ke panjang bulan
  const day = Math.max(1, rule.dayOfMonth ?? 1);
  let [ny, nm] = [ay, am];
  const effThis = Math.min(day, daysInMonth(ay, am));
  if (effThis > ad) {
    // masih bisa jatuh tempo bulan ini
    return isoDate(ay, am, effThis);
  }
  [ny, nm] = nm === 12 ? [ay + 1, 1] : [ay, am + 1];
  const effNext = Math.min(day, daysInMonth(ny, nm));
  return isoDate(ny, nm, effNext);
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function firstOccurrence(rule: Omit<RecurringRule, "nextDate" | "pending" | "id" | "createdAt" | "updatedAt"> & { nextDate?: string }): string {
  if (rule.nextDate) return rule.nextDate;
  const today = todayStr();
  if (rule.frequency === "weekly") {
    const weekday = rule.weekday ?? 0;
    const [ty, tm, td] = today.split("-").map(Number);
    const base = new Date(ty, tm - 1, td);
    const delta = (weekday - base.getDay() + 7) % 7;
    return delta === 0 ? today : addDays(today, delta);
  }
  const day = Math.max(1, rule.dayOfMonth ?? 1);
  const [ty, tm] = today.split("-").map(Number);
  const effThis = Math.min(day, daysInMonth(ty, tm));
  if (effThis >= Number(today.split("-")[2])) return isoDate(ty, tm, effThis);
  const [ny, nm] = tm === 12 ? [ty + 1, 1] : [ty, tm + 1];
  return isoDate(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

/**
 * Proses semua aturan yang jatuh tempo. Dipanggil saat app dibuka,
 * setelah simpan transaksi, dan saat pergantian hari.
 * - auto → buat transaksi (untuk setiap occurence yang terlewat, max 120 iterasi)
 * - confirm → kumpulkan PendingBill per occurence
 */
export async function processDueRules(): Promise<{ posted: number; pending: number }> {
  const today = todayStr();
  const rules = await db.recurringRules.toArray();
  let posted = 0, pending = 0;

  for (const rule of rules) {
    if (rule.deleted || !rule.active) continue;
    let next = rule.nextDate;
    let lastPosted = rule.lastPostedDate ?? null;
    const pendingList = [...(rule.pending ?? [])];
    let changed = false;
    let guard = 0;

    // mode auto: buat transaksi untuk setiap occurence terlewat
    let postedThisRule = 0;
    if (rule.mode === "auto") {
      while (next && next <= today && guard < 120) {
        guard++;
        // guard duplikat: occurence yang sama (tanggal sama) tidak dibuat dua kali
        if (lastPosted !== next) {
          const tx: Transaction = {
            id: uid(),
            type: rule.type,
            amount: rule.amount,
            categoryId: rule.categoryId,
            walletId: rule.walletId,
            toWalletId: null,
            date: next,
            note: rule.name,
            ruleId: rule.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            deleted: false,
          };
          await db.transactions.put(tx);
          posted++;
          postedThisRule++;
          lastPosted = next;
        }
        next = nextOccurrence(rule, next);
        changed = true;
      }
    }

    // mode confirm: kumpulkan tagihan menunggu (satu per occurence, max 12)
    if (rule.mode === "confirm") {
      while (next && next <= today && guard < 132) {
        guard++;
        const exists = pendingList.some((p) => p.dueDate === next);
        if (!exists && pendingList.length < 12) {
          pendingList.push({ id: uid(), ruleId: rule.id, dueDate: next, amount: rule.amount, createdAt: Date.now() });
          pending++;
          changed = true;
        }
        next = nextOccurrence(rule, next);
        changed = true;
      }
    }

    if (changed) {
      await db.recurringRules.update(rule.id, { nextDate: next, lastPostedDate: lastPosted, pending: pendingList, updatedAt: Date.now() });
    }
    if (postedThisRule > 0) {
      const id = useLang.getState().lang;
      void notifyAction(
        id === "id" ? "Tagihan otomatis tercatat" : "Bill auto-posted",
        id === "id"
          ? `"${rule.name}" · Rp${new Intl.NumberFormat("id-ID").format(rule.amount)} (${postedThisRule}x)`
          : `"${rule.name}" · Rp${new Intl.NumberFormat("id-ID").format(rule.amount)} (${postedThisRule}x)`,
        "alarm-clock"
      );
    }
  }
  return { posted, pending };
}

/** Konfirmasi tagihan: buat transaksi, lanjutkan siklus. */
export async function confirmPendingBill(ruleId: string, billId: string, amountOverride?: number): Promise<void> {
  const rule = await db.recurringRules.get(ruleId);
  if (!rule) return;
  const bill = rule.pending.find((p) => p.id === billId);
  if (!bill) return;
  const tx: Transaction = {
    id: uid(),
    type: rule.type,
    amount: amountOverride ?? bill.amount,
    categoryId: rule.categoryId,
    walletId: rule.walletId,
    toWalletId: null,
    date: bill.dueDate <= todayStr() ? todayStr() : bill.dueDate,
    note: rule.name,
    ruleId: rule.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deleted: false,
  };
  await db.transactions.put(tx);
  const rest = rule.pending.filter((p) => p.id !== billId);
  await db.recurringRules.update(ruleId, { pending: rest, lastPostedDate: bill.dueDate, updatedAt: Date.now() });
  const id = useLang.getState().lang;
  void notify(
    id === "id" ? "Tagihan tercatat" : "Bill recorded",
    id === "id"
      ? `"${rule.name}" · Rp${new Intl.NumberFormat("id-ID").format(tx.amount)}`
      : `"${rule.name}" · Rp${new Intl.NumberFormat("id-ID").format(tx.amount)}`,
    "alarm-clock"
  );
}

/** Lewati tagihan tanpa mencatat. */
export async function skipPendingBill(ruleId: string, billId: string): Promise<void> {
  const rule = await db.recurringRules.get(ruleId);
  if (!rule) return;
  await db.recurringRules.update(ruleId, {
    pending: rule.pending.filter((p) => p.id !== billId),
    updatedAt: Date.now(),
  });
}

export function pendingBillCount(rules: RecurringRule[]): number {
  return rules.filter((r) => !r.deleted && r.active).reduce((s, r) => s + r.pending.length, 0);
}

/** Daftar tagihan yang akan datang (untuk dashboard "Tagihan terdekat"). */
export function upcomingRules(rules: RecurringRule[], limit = 3): RecurringRule[] {
  return rules
    .filter((r) => !r.deleted && r.active)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, limit);
}

/** Cek pengingat H-N: kembalikan aturan yang jatuh tempo dalam N hari (untuk notifikasi). */
export function rulesDueWithin(rules: RecurringRule[], days: number, today: string = todayStr()): RecurringRule[] {
  const until = addDays(today, days);
  return rules.filter((r) => !r.deleted && r.active && r.nextDate >= today && r.nextDate <= until);
}
