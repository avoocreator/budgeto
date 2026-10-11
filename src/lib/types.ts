// ============================================================
// BUDGETO v3 — Type Definitions
// Mengikuti tech-stack.md 2.1: semua entri punya id (UUID klien),
// createdAt/updatedAt (epoch ms), dan soft delete (deleted).
// ============================================================

export type TxType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number; // selalu positif; arah ditentukan type
  categoryId: string | null; // null untuk transfer
  walletId: string;
  toWalletId?: string | null; // hanya transfer
  date: string; // "YYYY-MM-DD" (ISO, agar urutan & filter periode benar)
  note: string;
  ruleId?: string | null; // dibuat oleh aturan berulang (F06)
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
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
  amount: number; // per periode (F05)
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  icon: string;
  color: string;
  status: "active" | "achieved" | "archived";
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

// ─── F06: Transaksi berulang ────────────────────────────────
export type Frequency = "weekly" | "monthly";

/** Tagihan menunggu konfirmasi (mode "confirm") */
export interface PendingBill {
  id: string;
  ruleId: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  createdAt: number;
}

export interface RecurringRule {
  id: string;
  name: string;
  type: "expense" | "income";
  amount: number;
  categoryId: string;
  walletId: string;
  frequency: Frequency;
  dayOfMonth?: number; // 1-31 untuk monthly (29-31 di-clamp ke akhir bulan)
  weekday?: number; // 0-6 untuk weekly
  nextDate: string; // YYYY-MM-DD jatuh tempo berikutnya
  mode: "auto" | "confirm"; // auto = langsung dicatat; confirm = minta konfirmasi
  remindDaysBefore: number; // default 1 (H-1)
  active: boolean;
  lastPostedDate?: string | null; // guard duplikat
  pending: PendingBill[]; // tagihan menunggu konfirmasi
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

// ─── Periode & dashboard (F01, F05) ─────────────────────────
export type PeriodMode = "calendar" | "payday";

export interface Period {
  start: string; // YYYY-MM-DD inklusif
  end: string; // YYYY-MM-DD inklusif
}

export type DailyStatus = "ok" | "warn" | "bad";

export interface DailyRemaining {
  amount: number;
  status: DailyStatus;
  ready: boolean; // false jika budget/payday belum diatur → tampilkan ajakan
  period: Period;
  remainingDays: number;
  remainingBudget: number;
  upcomingBills: number;
  periodBudget: number;
  spent: number;
  dailyTarget: number; // rata-rata harian budget
}

// ─── Snapshot widget (F04) — kontrak v2 ───
// v2 menambahkan schemaId + colors (warna tema aktual dari app) agar
// widget Android bisa mengikuti tema aplikasi secara presisi.
export interface WidgetThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  income: string;
  expense: string;
  warn: string;
  bad: string;
}

export interface WidgetSnapshot {
  schema: 1 | 2;
  updatedAt: string; // ISO dengan offset zona waktu
  locale: string;
  privacy: boolean;
  theme: {
    mode: "light" | "dark";
    /** legacy preset id (emerald | ocean | …) — untuk APK lama */
    preset: string;
    /** schema tema baru (mocha | emerald | aqua | sunset | lavender) */
    schemaId?: string;
    /** warna final (sudah termasuk tone) — untuk APK v2 */
    colors?: WidgetThemeColors;
  };
  daily: { amount: number; status: DailyStatus | "none"; untilDate: string | null };
  budget: { usedPercent: number };
  balance: number;
  labels: {
    today: string;
    balance: string;
    budget: string;
    addExpense: string;
    addIncome: string;
    updated: string;
  };
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  budgets: Budget[];
  goals: Goal[];
  recurringRules: RecurringRule[];
  settings: SettingRow[];
}

// Palet warna kategori/dompet (kontras aman di light & dark)
export const PALETTE = [
  "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4",
  "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#a855f7",
] as const;

// legacy (dipertahankan untuk kompatibilitas — digunakan migrasi settings)
export const ACCENT_PRESETS = [
  { id: "emerald", label: "Emerald", swatch: "#34D399" },
  { id: "ocean", label: "Ocean", swatch: "#22d3ee" },
  { id: "sunset", label: "Sunset", swatch: "#fb923c" },
  { id: "violet", label: "Violet", swatch: "#a78bfa" },
  { id: "rose", label: "Rose", swatch: "#fb7185" },
  { id: "gold", label: "Gold", swatch: "#fbbf24" },
] as const;
