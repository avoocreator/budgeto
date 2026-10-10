// ============================================================
// BUDGETO v3 — Repository (CRUD + alur bisnis)
// Setiap perubahan data memicu: snapshot widget (F04), auto-sync
// (opsional), dan notifikasi/peringatan yang relevan.
// ============================================================

"use client";

import { db, uid } from "./db";
import type { Transaction, Category, Wallet, Budget, Goal, TxType, RecurringRule } from "./types";
import { budgetProgressList } from "./money";
import { currentPeriod } from "./period";
import { periodLabel } from "./period";
import { todayStr } from "./format";
import { scheduleSync } from "./sync";
import { notify, budgetAlertFlags } from "./notifications";
import { useSettings } from "./settings";
import { pushWidgetSnapshot } from "./widget";
import { firstOccurrence } from "./recurring";

const now = () => Date.now();

function afterChange(): void {
  void pushWidgetSnapshot();
  scheduleSync();
}

// ─── TRANSAKSI ───────────────────────────────────────────────
let lastSaveAt = 0;

export async function saveTransaction(input: {
  id?: string;
  type: TxType;
  amount: number;
  categoryId: string | null;
  walletId: string;
  toWalletId?: string | null;
  date: string;
  note: string;
}): Promise<Transaction | null> {
  // Guard tombol simpan dua kali cepat (F02): abaikan tap < 400 ms
  const t0 = now();
  if (!input.id && t0 - lastSaveAt < 400) return null;
  lastSaveAt = t0;

  const editing = input.id ? await db.transactions.get(input.id) : null;
  const tx: Transaction = {
    id: input.id ?? uid(),
    type: input.type,
    amount: Math.abs(input.amount),
    categoryId: input.type === "transfer" ? null : input.categoryId,
    walletId: input.walletId,
    toWalletId: input.type === "transfer" ? input.toWalletId ?? null : null,
    date: input.date,
    note: input.note.trim(),
    ruleId: editing?.ruleId ?? null,
    createdAt: editing?.createdAt ?? t0,
    updatedAt: t0,
    deleted: false,
  };
  await db.transactions.put(tx);
  useSettings.getState().set("lastWalletId", input.walletId);

  void fireTxNotification(tx);
  void checkBudgetAlerts();
  afterChange();
  return tx;
}

export async function deleteTransaction(id: string): Promise<Transaction | null> {
  const tx = await db.transactions.get(id);
  if (!tx || tx.deleted) return tx ?? null;
  await db.transactions.put({ ...tx, deleted: true, updatedAt: now() });
  afterChange();
  return tx;
}

/** Undo hapus (F08): transaksi kembali dengan id yang sama. */
export async function restoreTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put({ ...tx, deleted: false, updatedAt: now() });
  afterChange();
}

async function fireTxNotification(tx: Transaction): Promise<void> {
  const s = useSettings.getState();
  if (!s.notificationsEnabled || !s.txNotif) return;
  if (tx.type === "transfer") {
    void notify("Transfer dicatat", `Antar dompet sebesar Rp${tx.amount.toLocaleString("id-ID")}`, "wallet");
    return;
  }
  const cat = tx.categoryId ? await db.categories.get(tx.categoryId) : null;
  const title = tx.type === "income" ? "Pemasukan dicatat" : "Pengeluaran dicatat";
  const body = `${cat?.name ?? "Umum"} · ${tx.type === "income" ? "+" : "-"}Rp${tx.amount.toLocaleString("id-ID")}${tx.note ? ` · ${tx.note}` : ""}`;
  void notify(title, body, tx.type === "income" ? "trending-up" : "trending-down");
}

/** Peringatan budget 80% & 100% (sekali per level per periode). */
export async function checkBudgetAlerts(): Promise<void> {
  const s = useSettings.getState();
  if (!s.notificationsEnabled || !s.budgetAlerts) return;
  const [budgets, txs, cats] = await Promise.all([
    db.budgets.toArray(), db.transactions.toArray(), db.categories.toArray(),
  ]);
  const period = currentPeriod(s.periodMode, s.payday);
  const key = periodLabel(period, "id");
  const progresses = budgetProgressList(budgets, txs, period);
  for (const p of progresses) {
    if (p.budget.amount <= 0) continue;
    const cat = cats.find((c) => c.id === p.budget.categoryId && !c.deleted);
    const flag = budgetAlertFlags.getFlag(p.budget.id, key);
    if (p.percent >= 100 && flag < 2) {
      budgetAlertFlags.setFlag(p.budget.id, key, 2);
      void notify("Budget terlampaui!", `${cat?.name ?? "Kategori"} sudah terpakai ${Math.round(p.percent)}%`, "alarm-clock");
    } else if (p.percent >= 80 && flag < 1) {
      budgetAlertFlags.setFlag(p.budget.id, key, 1);
      void notify("Budget hampir habis", `${cat?.name ?? "Kategori"} terpakai ${Math.round(p.percent)}%`, "alarm-clock");
    }
  }
}

// ─── F02: Saran kategori dari riwayat ────────────────────────
/** Kategori yang paling sering dipakai pada transaksi serupa (jenis sama),
 *  dengan bonus bila catatan mirip. Dipakai sheet catat cepat. */
export async function suggestCategories(type: "income" | "expense", note = ""): Promise<{ ranked: Category[]; top: Category | null }> {
  const [txs, cats] = await Promise.all([
    db.transactions.orderBy("createdAt").reverse().limit(300).toArray(),
    db.categories.toArray(),
  ]);
  const score = new Map<string, number>();
  const noteLc = note.trim().toLowerCase();
  for (const t of txs) {
    if (t.deleted || t.type !== type || !t.categoryId) continue;
    let s = 1;
    if (noteLc && t.note && t.note.toLowerCase().includes(noteLc)) s += 3;
    // transaksi terbaru sedikit lebih berbobot
    s += Math.max(0, 1 - (now() - t.createdAt) / (90 * 86400000)) * 0.5;
    score.set(t.categoryId, (score.get(t.categoryId) ?? 0) + s);
  }
  const ranked = cats
    .filter((c) => !c.deleted && c.type === type)
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));
  const top = ranked[0] ?? null;
  return { ranked, top };
}

// ─── KATEGORI ────────────────────────────────────────────────
export async function saveCategory(input: { id?: string; name: string; type: "income" | "expense"; icon: string; color: string }): Promise<void> {
  const existing = input.id ? await db.categories.get(input.id) : null;
  const cat: Category = {
    id: input.id ?? uid(), name: input.name.trim(), type: input.type,
    icon: input.icon, color: input.color,
    createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false,
  };
  await db.categories.put(cat);
  afterChange();
}

export async function deleteCategory(id: string): Promise<void> {
  const cat = await db.categories.get(id);
  if (!cat) return;
  await db.categories.put({ ...cat, deleted: true, updatedAt: now() });
  afterChange();
}

// ─── DOMPET ──────────────────────────────────────────────────
export async function saveWallet(input: { id?: string; name: string; icon: string; color: string; initialBalance: number }): Promise<void> {
  const existing = input.id ? await db.wallets.get(input.id) : null;
  const w: Wallet = {
    id: input.id ?? uid(), name: input.name.trim(), icon: input.icon, color: input.color,
    initialBalance: input.initialBalance || 0,
    createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false,
  };
  await db.wallets.put(w);
  afterChange();
}

export async function deleteWallet(id: string): Promise<void> {
  const w = await db.wallets.get(id);
  if (!w) return;
  await db.wallets.put({ ...w, deleted: true, updatedAt: now() }); // selalu arsip (soft delete)
  afterChange();
}

// ─── BUDGET ──────────────────────────────────────────────────
export async function saveBudget(input: { id?: string; categoryId: string; amount: number }): Promise<void> {
  const existing = input.id ? await db.budgets.get(input.id) : null;
  const b: Budget = {
    id: input.id ?? uid(), categoryId: input.categoryId, amount: Math.abs(input.amount),
    createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false,
  };
  await db.budgets.put(b);
  void checkBudgetAlerts();
  afterChange();
}

export async function deleteBudget(id: string): Promise<void> {
  const b = await db.budgets.get(id);
  if (!b) return;
  await db.budgets.put({ ...b, deleted: true, updatedAt: now() });
  afterChange();
}

// ─── TARGET TABUNGAN ─────────────────────────────────────────
export async function saveGoal(input: { id?: string; name: string; targetAmount: number; currentAmount: number; deadline: string | null; icon: string; color: string; status?: Goal["status"] }): Promise<void> {
  const existing = input.id ? await db.goals.get(input.id) : null;
  const g: Goal = {
    id: input.id ?? uid(),
    name: input.name.trim(),
    targetAmount: Math.abs(input.targetAmount),
    currentAmount: Math.abs(input.currentAmount) || 0,
    deadline: input.deadline || null,
    icon: input.icon, color: input.color,
    status: input.status ?? "active",
    createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false,
  };
  if (g.currentAmount >= g.targetAmount) g.status = "achieved";
  await db.goals.put(g);
  afterChange();
}

export async function addToGoal(id: string, amount: number): Promise<void> {
  const g = await db.goals.get(id);
  if (!g || amount <= 0) return;
  const updated: Goal = { ...g, currentAmount: g.currentAmount + amount, updatedAt: now() };
  if (updated.currentAmount >= updated.targetAmount) {
    updated.status = "achieved";
    void notify("Target tercapai! 🎉", `Tabungan "${g.name}" sudah penuh`, "party-popper");
  }
  await db.goals.put(updated);
  afterChange();
}

export async function deleteGoal(id: string): Promise<void> {
  const g = await db.goals.get(id);
  if (!g) return;
  await db.goals.put({ ...g, deleted: true, updatedAt: now() });
  afterChange();
}

// ─── ATURAN BERULANG (F06) ───────────────────────────────────
export async function saveRecurringRule(input: {
  id?: string; name: string; type: "expense" | "income"; amount: number;
  categoryId: string; walletId: string; frequency: RecurringRule["frequency"];
  dayOfMonth?: number; weekday?: number; mode: RecurringRule["mode"];
  remindDaysBefore?: number; active?: boolean; nextDate?: string;
}): Promise<void> {
  const existing = input.id ? await db.recurringRules.get(input.id) : null;
  const rule: RecurringRule = {
    id: input.id ?? uid(),
    name: input.name.trim(),
    type: input.type,
    amount: Math.abs(input.amount),
    categoryId: input.categoryId,
    walletId: input.walletId,
    frequency: input.frequency,
    dayOfMonth: input.dayOfMonth,
    weekday: input.weekday,
    nextDate: input.nextDate ?? existing?.nextDate ?? firstOccurrence({ ...input, frequency: input.frequency, dayOfMonth: input.dayOfMonth, weekday: input.weekday, nextDate: input.nextDate } as never),
    mode: input.mode,
    remindDaysBefore: input.remindDaysBefore ?? 1,
    active: input.active ?? true,
    lastPostedDate: existing?.lastPostedDate ?? null,
    pending: existing?.pending ?? [],
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    deleted: false,
  };
  await db.recurringRules.put(rule);
  afterChange();
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const r = await db.recurringRules.get(id);
  if (!r) return;
  // transaksi yang sudah tercatat TIDAK ikut terhapus
  await db.recurringRules.put({ ...r, deleted: true, active: false, updatedAt: now() });
  afterChange();
}

// ─── EKSPOR / IMPOR / RESET ─────────────────────────────────
export async function exportData(): Promise<string> {
  const [transactions, categories, wallets, budgets, goals, recurringRules] = await Promise.all([
    db.transactions.toArray(), db.categories.toArray(), db.wallets.toArray(),
    db.budgets.toArray(), db.goals.toArray(), db.recurringRules.toArray(),
  ]);
  return JSON.stringify(
    { app: "budgeto", version: 3, exportedAt: new Date().toISOString(), transactions, categories, wallets, budgets, goals, recurringRules },
    null, 2
  );
}

export function downloadFile(filename: string, content: string, mime = "application/json"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(txs: Transaction[], cats: Category[], wallets: Wallet[]): string {
  const rows = [["Tanggal", "Jenis", "Kategori", "Dompet", "Catatan", "Jumlah"]];
  const sorted = [...txs].filter((t) => !t.deleted).sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    rows.push([
      t.date,
      t.type === "income" ? "pemasukan" : t.type === "expense" ? "pengeluaran" : "transfer",
      t.categoryId ? cats.find((c) => c.id === t.categoryId)?.name ?? "" : "",
      wallets.find((w) => w.id === t.walletId)?.name ?? "",
      t.note.replace(/"/g, '""'),
      String(t.amount),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

export interface ImportResult { ok: boolean; message: string; counts?: Record<string, number> }

/** Impor backup v3 (dan v2 tanpa recurringRules). Mode: gabung (upsert per id). */
export async function importData(json: string, mode: "merge" | "replace" = "merge"): Promise<ImportResult> {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    if (data.app !== "budgeto") return { ok: false, message: "File bukan backup Budgeto" };
    const ts = now();
    const counts: Record<string, number> = {};

    if (mode === "replace") {
      await Promise.all([db.transactions.clear(), db.categories.clear(), db.wallets.clear(), db.budgets.clear(), db.goals.clear(), db.recurringRules.clear()]);
    }

    const putAll = async <T extends { id: string; updatedAt?: number }>(key: string, table: { put(v: T): Promise<unknown> }) => {
      const arr = data[key];
      if (!Array.isArray(arr)) return;
      for (const row of arr as T[]) {
        await table.put({ ...row, updatedAt: row.updatedAt ?? ts } as T);
      }
      counts[key] = arr.length;
    };

    await putAll("transactions", db.transactions);
    await putAll("categories", db.categories);
    await putAll("wallets", db.wallets);
    await putAll("budgets", db.budgets);
    await putAll("goals", db.goals);
    await putAll("recurringRules", db.recurringRules);

    useSettings.getState().set("lastBackupAt", ts);
    afterChange();
    return { ok: true, message: "Data berhasil dipulihkan", counts };
  } catch {
    return { ok: false, message: "File rusak atau format tidak valid" };
  }
}

export async function resetAllData(): Promise<void> {
  await Promise.all([
    db.transactions.clear(), db.categories.clear(), db.wallets.clear(),
    db.budgets.clear(), db.goals.clear(), db.recurringRules.clear(),
  ]);
  const { seedIfEmpty } = await import("./db");
  await seedIfEmpty();
  afterChange();
}

export { todayStr };
