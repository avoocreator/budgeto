// ============================================================
// BUDGETO v3 — Widget 4x2 offline (F04, sisi web/app)
// Prinsip: widget TIDAK PERNAH mengambil data sendiri.
// App menghitung ringkasan tiap data berubah, lalu:
//  - di APK: plugin Capacitor kustom `WidgetBridge` menulis snapshot
//    ke SharedPreferences (Android) + memicu AppWidgetManager.
//  - di web/PWA: snapshot disimpan ke localStorage (untuk uji/preview).
// Kontrak snapshot: tech-stack.md 2.3 (schema:1).
// Deep link tombol widget: budgeto://add?type=expense|income →
// ditangkap sisi web di app-shell (/?action=add&type=...).
// ============================================================

"use client";

import { db } from "./db";
import type { WidgetSnapshot, DailyStatus } from "./types";
import { computeDailyRemaining, totalBalance, budgetProgressList } from "./money";
import { currentPeriod, periodLabel } from "./period";
import { todayStr } from "./format";
import { useSettings } from "./settings";
import { useLang } from "./i18n";

const SNAPSHOT_KEY = "budgeto-widget-snapshot";

export function buildSnapshot(themeModeOverride?: "light" | "dark"): WidgetSnapshot {
  const s = useSettings.getState();
  const lang = useLang.getState().lang;
  const t = require0(lang);

  // baca data sinkron (dipanggil setelah penulisan Dexie selesai)
  return buildSnapshotAsync(t, s, themeModeOverride) as unknown as WidgetSnapshot;
}

// --- helper: kamus label untuk snapshot (sinkron, tanpa import melingkar) ---
function require0(lang: "id" | "en"): Record<string, string> {
  return lang === "id"
    ? { today: "Sisa hari ini", balance: "Saldo", budget: "Budget", addExpense: "+ Pengeluaran", addIncome: "+ Pemasukan", updated: "diperbarui" }
    : { today: "Today's allowance", balance: "Balance", budget: "Budget", addExpense: "+ Expense", addIncome: "+ Income", updated: "updated" };
}

async function buildSnapshotAsync(
  labels: Record<string, string>,
  s: ReturnType<typeof useSettings.getState>,
  themeModeOverride?: "light" | "dark"
): Promise<WidgetSnapshot> {
  const [txs, wallets, budgets, rules] = await Promise.all([
    db.transactions.toArray(), db.wallets.toArray(), db.budgets.toArray(), db.recurringRules.toArray(),
  ]);
  const period = currentPeriod(s.periodMode, s.payday);
  const daily = computeDailyRemaining({ txs, budgets, rules, period });
  const balance = totalBalance(txs, wallets);
  const progresses = budgetProgressList(budgets, txs, period);
  const totalBudget = progresses.reduce((sum, p) => sum + p.budget.amount, 0);
  const usedPercent = totalBudget > 0 ? Math.round((daily.spent / totalBudget) * 100) : 0;
  const dark = themeModeOverride ?? resolveDark();

  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    locale: s.lang,
    privacy: s.privacyMode,
    theme: { mode: dark ? "dark" : "light", preset: s.accent },
    daily: {
      amount: Math.round(daily.amount),
      status: daily.ready ? (daily.status as DailyStatus) : "none",
      untilDate: period.end,
    },
    budget: { usedPercent: Math.max(0, usedPercent) },
    balance: Math.round(balance),
    labels: {
      today: labels.today,
      balance: labels.balance,
      budget: labels.budget,
      addExpense: labels.addExpense,
      addIncome: labels.addIncome,
      updated: labels.updated,
    },
  };
}

function resolveDark(): boolean {
  const mode = useSettings.getState().themeMode;
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Hitung & kirim snapshot ke widget. Cepat, tanpa jaringan. */
export async function pushWidgetSnapshot(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const s = useSettings.getState();
    const lang = useLang.getState().lang;
    const labels = require0(lang);
    const snap = await buildSnapshotAsync(labels, s);
    const json = JSON.stringify(snap);

    // 1) localStorage — fallback + sumber untuk widget preview
    localStorage.setItem(SNAPSHOT_KEY, json);

    // 2) APK: plugin kustom WidgetBridge (didftarkan di MainActivity Android)
    const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, { push?: (opts: { snapshot: string }) => void }> } }).Capacitor;
    const bridge = cap?.Plugins?.WidgetBridge;
    if (bridge?.push) {
      try { bridge.push({ snapshot: json }); } catch { /* plugin belum siap — abaikan */ }
    }
  } catch {
    // snapshot gagal — app tetap berjalan
  }
}

export function getStoredSnapshot(): WidgetSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export function periodLabelText(): string {
  const s = useSettings.getState();
  return periodLabel(currentPeriod(s.periodMode, s.payday), useLang.getState().lang);
}

export function todayISO(): string {
  return todayStr();
}
