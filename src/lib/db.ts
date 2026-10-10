// ============================================================
// BUDGETO v3 — Database Lokal (IndexedDB via Dexie)
// Offline-first: semua data tersimpan di perangkat.
// DB baru "budgeto-v3" (v2 tetap tak tersentuh; migrasi manual via backup).
// ============================================================

import Dexie, { type Table } from "dexie";
import type { Transaction, Category, Wallet, Budget, Goal, SettingRow, RecurringRule } from "./types";

export class BudgetoDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  wallets!: Table<Wallet, string>;
  budgets!: Table<Budget, string>;
  goals!: Table<Goal, string>;
  recurringRules!: Table<RecurringRule, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("budgeto-v3");
    this.version(1).stores({
      // indeks mendukung filter periode, sync delta, dan pencarian cepat
      transactions: "id, date, type, categoryId, walletId, ruleId, createdAt, updatedAt, [date+type]",
      categories: "id, type, name, updatedAt",
      wallets: "id, name, updatedAt",
      budgets: "id, categoryId, updatedAt",
      goals: "id, status, updatedAt",
      recurringRules: "id, type, nextDate, active, updatedAt",
      settings: "key, updatedAt",
    });
  }
}

export const db = new BudgetoDB();

/** id selalu UUID penuh (crypto.randomUUID) — aman dipakai PK global lintas pengguna. */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // fallback sangat kecil kemungkinan terpakai; tetap UUID-format
  return `${Date.now().toString(16).padStart(12, "0")}-4${Math.random().toString(16).slice(1, 12)}-a${Math.random().toString(16).slice(1, 12)}-b${Math.random().toString(16).slice(1, 12)}${Date.now().toString(16).slice(-4)}`;
}

// ─── SEED DATA ───────────────────────────────────────────────
const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Makan & Minum", type: "expense", icon: "utensils", color: "#f59e0b" },
  { name: "Transportasi", type: "expense", icon: "car", color: "#06b6d4" },
  { name: "Belanja", type: "expense", icon: "shopping-bag", color: "#ec4899" },
  { name: "Hiburan", type: "expense", icon: "clapperboard", color: "#a855f7" },
  { name: "Kesehatan", type: "expense", icon: "heart-pulse", color: "#ef4444" },
  { name: "Tagihan", type: "expense", icon: "zap", color: "#f97316" },
  { name: "Kopi", type: "expense", icon: "coffee", color: "#84cc16" },
  { name: "Sembako", type: "expense", icon: "shopping-cart", color: "#14b8a6" },
  { name: "Pendidikan", type: "expense", icon: "graduation-cap", color: "#8b5cf6" },
  { name: "Kos & Listrik", type: "expense", icon: "house", color: "#f43f5e" },
  { name: "Lain-lain", type: "expense", icon: "shapes", color: "#64748b" },
  { name: "Gaji", type: "income", icon: "wallet", color: "#10b981" },
  { name: "Freelance", type: "income", icon: "laptop", color: "#22c55e" },
  { name: "Investasi", type: "income", icon: "trending-up", color: "#0ea5e9" },
  { name: "Hadiah", type: "income", icon: "gift", color: "#f43f5e" },
  { name: "Bonus", type: "income", icon: "sparkles", color: "#eab308" },
];

const DEFAULT_WALLETS: Omit<Wallet, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Uang Tunai", icon: "banknote", color: "#10b981", initialBalance: 0 },
  { name: "E-Wallet", icon: "smartphone", color: "#06b6d4", initialBalance: 0 },
];

export async function seedIfEmpty(): Promise<void> {
  await db.transaction("rw", db.categories, db.wallets, async () => {
    const catCount = await db.categories.count();
    if (catCount === 0) {
      const now = Date.now();
      const cats: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
        ...c, id: uid(), createdAt: now + i, updatedAt: now + i,
      }));
      await db.categories.bulkAdd(cats);
    }
    const walletCount = await db.wallets.count();
    if (walletCount === 0) {
      const now = Date.now();
      const wallets: Wallet[] = DEFAULT_WALLETS.map((w, i) => ({
        ...w, id: uid(), createdAt: now + i, updatedAt: now + i,
      }));
      await db.wallets.bulkAdd(wallets);
    }
  });
}
