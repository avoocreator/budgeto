// ============================================================
// BUDGETO v2 — Repository (CRUD + trigger sinkron & notifikasi)
// ============================================================

"use client";

import { db, uid } from "./db";
import type { Transaction, Category, Wallet, Budget, Goal, TxType } from "./types";
import { monthlySummary } from "./stats";
import { monthStr, formatMoney } from "./format";
import { scheduleSync } from "./sync";
import { notify, budgetAlertFlags } from "./notifications";
import { useSettings } from "./settings";

const now = () => Date.now();

// ─── TRANSAKSI ───────────────────────────────────────────────
export async function saveTransaction(input: {
  id?: string;
  type: TxType;
  amount: number;
  categoryId: string | null;
  walletId: string;
  toWalletId?: string | null;
  date: string;
  note: string;
}): Promise<Transaction> {
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
    createdAt: editing?.createdAt ?? now(),
    updatedAt: now(),
    deleted: false,
  };
  await db.transactions.put(tx);

  // Notifikasi transaksi
  void fireTxNotification(tx);
  // Cek budget alert
  void checkBudgetAlerts(tx.date.slice(0, 7));
  // Auto sync cloud
  scheduleSync();
  return tx;
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = await db.transactions.get(id);
  if (!tx) return;
  await db.transactions.put({ ...tx, deleted: true, updatedAt: now() });
  scheduleSync();
}

async function fireTxNotification(tx: Transaction): Promise<void> {
  const s = useSettings.getState();
  if (!s.notificationsEnabled || !s.txNotif) return;
  const cur = s.currency;
  if (tx.type === "transfer") {
    void notify("Transfer dicatat", `Antar dompet sebesar ${formatMoney(tx.amount, cur)}`, "wallet");
    return;
  }
  const cat = tx.categoryId ? await db.categories.get(tx.categoryId) : null;
  const title = tx.type === "income" ? "Pemasukan dicatat" : "Pengeluaran dicatat";
  const body = `${cat?.name ?? "Umum"} · ${tx.type === "income" ? "+" : "-"}${formatMoney(tx.amount, cur)}${tx.note ? ` · ${tx.note}` : ""}`;
  void notify(title, body, tx.type === "income" ? "trending-up" : "trending-down");
}

export async function checkBudgetAlerts(month: string): Promise<void> {
  const s = useSettings.getState();
  if (!s.notificationsEnabled || !s.budgetAlerts) return;
  const [budgets, txs, cats] = await Promise.all([
    db.budgets.toArray(),
    db.transactions.where("date").startsWith(month).toArray(),
    db.categories.toArray(),
  ]);
  const cur = s.currency;
  const spentMap = new Map<string, number>();
  for (const t of txs) {
    if (t.deleted || t.type !== "expense" || !t.categoryId) continue;
    spentMap.set(t.categoryId, (spentMap.get(t.categoryId) ?? 0) + t.amount);
  }
  for (const b of budgets) {
    if (b.deleted || b.amount <= 0) continue;
    const spent = spentMap.get(b.categoryId) ?? 0;
    const pct = (spent / b.amount) * 100;
    const cat = cats.find((c) => c.id === b.categoryId);
    const flag = budgetAlertFlags.getFlag(b.id, month);
    if (pct >= 100 && flag < 2) {
      budgetAlertFlags.setFlag(b.id, month, 2);
      void notify(
        "Budget terlampaui!",
        `${cat?.name ?? "Kategori"} sudah ${formatMoney(spent, cur)} dari budget ${formatMoney(b.amount, cur)}`,
        "alarm-clock"
      );
    } else if (pct >= 80 && flag < 1) {
      budgetAlertFlags.setFlag(b.id, month, 1);
      void notify(
        "Budget hampir habis",
        `${cat?.name ?? "Kategori"} terpakai ${Math.round(pct)}% (${formatMoney(spent, cur)})`,
        "alarm-clock"
      );
    }
  }
}

// ─── KATEGORI ────────────────────────────────────────────────
export async function saveCategory(input: { id?: string; name: string; type: "income" | "expense"; icon: string; color: string }): Promise<void> {
  const existing = input.id ? await db.categories.get(input.id) : null;
  const cat: Category = { id: input.id ?? uid(), name: input.name.trim(), type: input.type, icon: input.icon, color: input.color, createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false };
  await db.categories.put(cat);
  scheduleSync();
}

export async function deleteCategory(id: string): Promise<void> {
  const cat = await db.categories.get(id);
  if (!cat) return;
  await db.categories.put({ ...cat, deleted: true, updatedAt: now() });
  scheduleSync();
}

// ─── DOMPET ──────────────────────────────────────────────────
export async function saveWallet(input: { id?: string; name: string; icon: string; color: string; initialBalance: number }): Promise<void> {
  const existing = input.id ? await db.wallets.get(input.id) : null;
  const w: Wallet = { id: input.id ?? uid(), name: input.name.trim(), icon: input.icon, color: input.color, initialBalance: input.initialBalance || 0, createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false };
  await db.wallets.put(w);
  scheduleSync();
}

export async function deleteWallet(id: string): Promise<void> {
  const w = await db.wallets.get(id);
  if (!w) return;
  const txCount = await db.transactions.where("walletId").equals(id).count();
  if (txCount > 0) {
    // dompet masih dipakai transaksi → arsip saja
    await db.wallets.put({ ...w, deleted: true, updatedAt: now() });
  } else {
    await db.wallets.put({ ...w, deleted: true, updatedAt: now() });
  }
  scheduleSync();
}

// ─── BUDGET ──────────────────────────────────────────────────
export async function saveBudget(input: { id?: string; categoryId: string; amount: number }): Promise<void> {
  const existing = input.id ? await db.budgets.get(input.id) : null;
  const b: Budget = { id: input.id ?? uid(), categoryId: input.categoryId, amount: Math.abs(input.amount), createdAt: existing?.createdAt ?? now(), updatedAt: now(), deleted: false };
  await db.budgets.put(b);
  scheduleSync();
}

export async function deleteBudget(id: string): Promise<void> {
  const b = await db.budgets.get(id);
  if (!b) return;
  await db.budgets.put({ ...b, deleted: true, updatedAt: now() });
  scheduleSync();
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
    icon: input.icon,
    color: input.color,
    status: input.status ?? "active",
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    deleted: false,
  };
  if (g.currentAmount >= g.targetAmount) g.status = "achieved";
  await db.goals.put(g);
  scheduleSync();
}

export async function addToGoal(id: string, amount: number, walletId: string | null): Promise<void> {
  const g = await db.goals.get(id);
  if (!g || amount <= 0) return;
  const updated: Goal = { ...g, currentAmount: g.currentAmount + amount, updatedAt: now() };
  if (updated.currentAmount >= updated.targetAmount) {
    updated.status = "achieved";
    const s = useSettings.getState();
    void notify("Target tercapai! 🎉", `Tabungan "${g.name}" sudah penuh: ${formatMoney(updated.currentAmount, s.currency)}`, "party-popper");
  }
  await db.goals.put(updated);
  // Optional: catat sebagai transaksi expense (uang disisihkan)
  if (walletId) {
    await db.transactions.put({
      id: uid(), type: "expense", amount, categoryId: null, walletId,
      date: new Date().toISOString().slice(0, 10),
      note: `Tabungan: ${g.name}`, createdAt: now(), updatedAt: now(),
    });
  }
  scheduleSync();
}

export async function deleteGoal(id: string): Promise<void> {
  const g = await db.goals.get(id);
  if (!g) return;
  await db.goals.put({ ...g, deleted: true, updatedAt: now() });
  scheduleSync();
}

// ─── EKSPOR / IMPOR / RESET ─────────────────────────────────
export async function exportData(): Promise<string> {
  const [transactions, categories, wallets, budgets, goals] = await Promise.all([
    db.transactions.toArray(), db.categories.toArray(), db.wallets.toArray(), db.budgets.toArray(), db.goals.toArray(),
  ]);
  return JSON.stringify({ app: "budgeto", version: 2, exportedAt: new Date().toISOString(), transactions, categories, wallets, budgets, goals }, null, 2);
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(txs: Transaction[], cats: Category[]): string {
  const rows = [["Tanggal", "Jenis", "Kategori", "Catatan", "Jumlah"]];
  const sorted = [...txs].filter((t) => !t.deleted).sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    rows.push([
      t.date,
      t.type === "income" ? "pemasukan" : t.type === "expense" ? "pengeluaran" : "transfer",
      t.categoryId ? cats.find((c) => c.id === t.categoryId)?.name ?? "" : "",
      t.note.replace(/"/g, '""'),
      String(t.amount),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

export async function importData(json: string): Promise<{ ok: boolean; message: string }> {
  try {
    const data = JSON.parse(json);
    if (data.app !== "budgeto") return { ok: false, message: "File bukan backup Budgeto" };
    const nowTs = now();
    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) await db.transactions.put({ ...t, updatedAt: nowTs } as Transaction);
    }
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) await db.categories.put({ ...c, updatedAt: nowTs } as Category);
    }
    if (Array.isArray(data.wallets)) {
      for (const w of data.wallets) await db.wallets.put({ ...w, updatedAt: nowTs } as Wallet);
    }
    if (Array.isArray(data.budgets)) {
      for (const b of data.budgets) await db.budgets.put({ ...b, updatedAt: nowTs } as Budget);
    }
    if (Array.isArray(data.goals)) {
      for (const g of data.goals) await db.goals.put({ ...g, updatedAt: nowTs } as Goal);
    }
    scheduleSync();
    return { ok: true, message: "Data berhasil dipulihkan" };
  } catch {
    return { ok: false, message: "File rusak atau format tidak valid" };
  }
}

export async function resetAllData(): Promise<void> {
  await Promise.all([
    db.transactions.clear(), db.categories.clear(), db.wallets.clear(), db.budgets.clear(), db.goals.clear(),
  ]);
  const { seedIfEmpty } = await import("./db");
  await seedIfEmpty();
  scheduleSync();
}
