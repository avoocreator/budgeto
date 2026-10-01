// ============================================================
// BUDGETO v2 — Type Definitions
// ============================================================

export type TxType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number; // selalu positif; arah ditentukan oleh type
  categoryId: string | null; // null untuk transfer
  walletId: string;
  toWalletId?: string | null; // hanya untuk transfer
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms — dipakai untuk sinkronisasi LWW
  deleted?: boolean; // soft delete agar sync aman
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string; // nama ikon lucide
  color: string; // hex
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  icon: string;
  color: string;
  initialBalance: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number; // per bulan
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null; // YYYY-MM-DD
  icon: string;
  color: string;
  status: "active" | "achieved" | "archived";
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  budgets: Budget[];
  goals: Goal[];
  settings: SettingRow[];
}

export const CURRENCIES = [
  { code: "IDR", symbol: "Rp", locale: "id-ID" },
  { code: "USD", symbol: "$", locale: "en-US" },
  { code: "EUR", symbol: "€", locale: "de-DE" },
  { code: "SGD", symbol: "S$", locale: "en-SG" },
  { code: "MYR", symbol: "RM", locale: "ms-MY" },
  { code: "JPY", symbol: "¥", locale: "ja-JP" },
] as const;

// Palet warna kategori dompet (aman untuk light & dark)
export const PALETTE = [
  "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4",
  "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#a855f7",
] as const;
