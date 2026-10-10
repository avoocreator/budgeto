// ============================================================
// BUDGETO v3 — Logika uang (F01 + laporan)
// Sumber kebenaran: Dexie. Semua fungsi murni bila memungkinkan
// agar mudah dites: skenario F01 → budget 1.500.000, terpakai
// 600.000, sisa 10 hari, tagihan 100.000 → sisa harian 80.000.
// ============================================================

import type { Transaction, Wallet, Budget, Category, DailyRemaining, DailyStatus, RecurringRule } from "./types";
import type { Period } from "./types";
import { remainingDays, periodLength } from "./period";
import { todayStr } from "./format";

export function inPeriod(date: string, p: Period): boolean {
  return date >= p.start && date <= p.end;
}

export function activeTxs(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => !t.deleted);
}

/** Saldo satu dompet = saldo awal + pemasukan - pengeluaran + masuk transfer - keluar transfer. */
export function walletBalance(walletId: string, txs: Transaction[], wallets: Wallet[]): number {
  const w = wallets.find((x) => x.id === walletId);
  let bal = w?.initialBalance ?? 0;
  for (const t of activeTxs(txs)) {
    if (t.type === "income" && t.walletId === walletId) bal += t.amount;
    else if (t.type === "expense" && t.walletId === walletId) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.walletId === walletId) bal -= t.amount;
      if (t.toWalletId === walletId) bal += t.amount;
    }
  }
  return bal;
}

export function totalBalance(txs: Transaction[], wallets: Wallet[]): number {
  return wallets.reduce((sum, w) => sum + walletBalance(w.id, txs, wallets), 0);
}

export interface PeriodSummary {
  income: number;
  expense: number;
}

export function periodSummary(txs: Transaction[], p: Period): PeriodSummary {
  let income = 0, expense = 0;
  for (const t of activeTxs(txs)) {
    if (!inPeriod(t.date, p)) continue;
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  return { income, expense };
}

export function spentByCategory(txs: Transaction[], p: Period): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of activeTxs(txs)) {
    if (t.type !== "expense" || !t.categoryId || !inPeriod(t.date, p)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return map;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  percent: number; // 0-100+
  remaining: number;
}

export function budgetProgressList(budgets: Budget[], txs: Transaction[], p: Period): BudgetProgress[] {
  const spentMap = spentByCategory(txs, p);
  return budgets
    .filter((b) => !b.deleted)
    .map((b) => {
      const spent = spentMap.get(b.categoryId) ?? 0;
      const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      return { budget: b, spent, percent, remaining: b.amount - spent };
    });
}

/** Total tagihan berulang (expense) yang belum tercatat & jatuh tempo dalam periode. */
export function upcomingBillsInPeriod(rules: RecurringRule[], p: Period, today: string = todayStr()): number {
  let total = 0;
  for (const r of rules) {
    if (r.deleted || !r.active || r.type !== "expense") continue;
    // tagihan yang menunggu konfirmasi juga ikut dikurangkan
    for (const pb of r.pending) {
      if (pb.dueDate <= p.end) total += pb.amount;
    }
    const nd = r.nextDate;
    if (nd && nd <= p.end && nd >= p.start) {
      // jatuh tempo di dalam periode & belum diposting (mode auto mem-post saat proses berjalan)
      total += r.amount;
    } else if (nd && nd <= today && nd >= p.start) {
      total += 0; // sudah diproses engine
    }
  }
  return total;
}

/** Ambang status (design.md): ok ≥70% target harian, warn 30–70%, bad <30% / negatif. */
export function statusFromRatio(ratio: number, negative: boolean): DailyStatus {
  if (negative || ratio < 0.3) return "bad";
  if (ratio < 0.7) return "warn";
  return "ok";
}

/**
 * F01 — Sisa harian:
 * sisa_harian = (sisa_budget_periode − tagihan_berulang_belum_jatuh_tempo) / sisa_hari_periode
 * Skenario uji: 1.500.000 budget, 600.000 terpakai, 10 hari, tagihan 100.000 → 80.000.
 */
export function computeDailyRemaining(input: {
  txs: Transaction[];
  budgets: Budget[];
  rules: RecurringRule[];
  period: Period;
  today?: string;
}): DailyRemaining {
  const { txs, budgets, rules, period } = input;
  const today = input.today ?? todayStr();
  const periodBudget = budgets.filter((b) => !b.deleted).reduce((s, b) => s + b.amount, 0);
  const { expense: spent } = periodSummary(txs, period);
  const remainingBudget = periodBudget - spent;
  const upcoming = upcomingBillsInPeriod(rules, period, today);
  const days = remainingDays(period, today);
  const totalDays = periodLength(period);
  const ready = periodBudget > 0;
  const dailyTarget = periodBudget / totalDays;
  const amount = Math.floor((remainingBudget - upcoming) / days); // Rupiah: selalu bulat ke bawah (konservatif)
  const ratio = dailyTarget > 0 ? amount / dailyTarget : amount > 0 ? 1 : 0;
  const status = statusFromRatio(ratio, amount < 0);
  return {
    amount,
    status,
    ready,
    period,
    remainingDays: days,
    remainingBudget,
    upcomingBills: upcoming,
    periodBudget,
    spent,
    dailyTarget,
  };
}

export function topCategoryName(spentMap: Map<string, number>, cats: Category[]): { name: string; value: number } | null {
  let topId: string | null = null, topVal = 0;
  spentMap.forEach((v, k) => { if (v > topVal) { topVal = v; topId = k; } });
  if (!topId) return null;
  const cat = cats.find((c) => c.id === topId);
  return cat ? { name: cat.name, value: topVal } : null;
}
