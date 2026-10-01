// ============================================================
// BUDGETO v2 — Agregasi & Statistik
// ============================================================

import type { Transaction, Category, Wallet, Budget, Goal } from "./types";
import { monthStr, daysInMonth, todayStr } from "./format";

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
}

export function sumTx(txs: Transaction[], type: "income" | "expense"): number {
  return txs.filter((t) => t.type === type && !t.deleted).reduce((s, t) => s + t.amount, 0);
}

export function monthlySummary(txs: Transaction[], month: string): MonthSummary {
  const inMonth = txs.filter((t) => !t.deleted && t.date.startsWith(month) && t.type !== "transfer");
  const income = sumTx(inMonth, "income");
  const expense = sumTx(inMonth, "expense");
  return { income, expense, net: income - expense };
}

export function totalBalance(txs: Transaction[], wallets: Wallet[]): number {
  const live = wallets.filter((w) => !w.deleted);
  if (live.length === 0) return 0;
  const init = live.reduce((s, w) => s + w.initialBalance, 0);
  let delta = 0;
  for (const t of txs) {
    if (t.deleted) continue;
    if (t.type === "income") delta += t.amount;
    else if (t.type === "expense") delta -= t.amount;
    // transfer antar dompet tidak mengubah total
  }
  return init + delta;
}

export function walletBalance(txs: Transaction[], wallet: Wallet): number {
  let bal = wallet.initialBalance;
  for (const t of txs) {
    if (t.deleted) continue;
    if (t.type === "income" && t.walletId === wallet.id) bal += t.amount;
    else if (t.type === "expense" && t.walletId === wallet.id) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.walletId === wallet.id) bal -= t.amount;
      if (t.toWalletId === wallet.id) bal += t.amount;
    }
  }
  return bal;
}

export function categoryBreakdown(txs: Transaction[], month: string, type: "income" | "expense"): { categoryId: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.deleted || t.type !== type || !t.date.startsWith(month) || !t.categoryId) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlyTrend(txs: Transaction[], months = 6): { month: string; income: number; expense: number }[] {
  const out: { month: string; income: number; expense: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = monthStr(-i);
    const s = monthlySummary(txs, m);
    out.push({ month: m, income: s.income, expense: s.expense });
  }
  return out;
}

export function dailyActivity(txs: Transaction[], month: string): { date: string; income: number; expense: number }[] {
  const map = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    if (t.deleted || t.type === "transfer" || !t.date.startsWith(month)) continue;
    const cur = map.get(t.date) ?? { income: 0, expense: 0 };
    if (t.type === "income") cur.income += t.amount;
    else cur.expense += t.amount;
    map.set(t.date, cur);
  }
  const days = daysInMonth(month);
  const out: { date: string; income: number; expense: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const v = map.get(date) ?? { income: 0, expense: 0 };
    out.push({ date, ...v });
    if (date >= todayStr()) break; // jangan plot masa depan
  }
  return out;
}

// ─── Budget ──────────────────────────────────────────────────
export interface BudgetProgress {
  budget: Budget;
  spent: number;
  percent: number; // 0-999
  remaining: number;
}

export function budgetProgress(txs: Transaction[], budgets: Budget[], month: string): BudgetProgress[] {
  const breakdown = categoryBreakdown(txs, month, "expense");
  const spentMap = new Map(breakdown.map((b) => [b.categoryId, b.amount]));
  return budgets
    .filter((b) => !b.deleted)
    .map((b) => {
      const spent = spentMap.get(b.categoryId) ?? 0;
      return {
        budget: b,
        spent,
        percent: b.amount > 0 ? Math.min(999, Math.round((spent / b.amount) * 100)) : 0,
        remaining: b.amount - spent,
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

// ─── Insights ────────────────────────────────────────────────
export interface Insights {
  biggestExpense: Transaction | null;
  avgDailySpend: number;
  topCategory: { category: Category; amount: number } | null;
  expenseCount: number;
  projectedMonthEnd: number;
}

export function computeInsights(txs: Transaction[], categories: Category[], month: string): Insights {
  const inMonth = txs.filter((t) => !t.deleted && t.date.startsWith(month));
  const expenses = inMonth.filter((t) => t.type === "expense");
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const today = todayStr();
  const dayOfMonth = today.startsWith(month) ? Number(today.slice(8)) : daysInMonth(month);
  const catMap = new Map<string, number>();
  for (const t of expenses) if (t.categoryId) catMap.set(t.categoryId, (catMap.get(t.categoryId) ?? 0) + t.amount);
  const topEntry = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0] ?? null;
  return {
    biggestExpense: biggest ?? null,
    avgDailySpend: dayOfMonth > 0 ? Math.round(totalExpense / dayOfMonth) : 0,
    topCategory: topEntry && categories.length
      ? { category: categories.find((c) => c.id === topEntry[0])!, amount: topEntry[1] }
      : null,
    expenseCount: expenses.length,
    projectedMonthEnd: Math.round((totalExpense / Math.max(1, dayOfMonth)) * daysInMonth(month)),
  };
}

export function goalProgress(goals: Goal[]): Goal[] {
  return [...goals]
    .filter((g) => !g.deleted && g.status !== "archived")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
}
