"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { db } from "./db";
import type { WidgetSnapshot, DailyStatus } from "./types";
import { computeDailyRemaining, totalBalance, budgetProgressList } from "./money";
import { currentPeriod, periodLabel } from "./period";
import { todayStr } from "./format";
import { useSettings } from "./settings";
import { useLang } from "./i18n";
import { resolveIsDark, resolvePalette, type ThemePalette } from "./themes";

const SNAPSHOT_KEY = "budgeto-widget-snapshot";

// Plugin native (WidgetBridgePlugin.java) — hanya ada di APK
const WidgetBridge = registerPlugin<{ push(options: { snapshot: string }): Promise<void> }>("WidgetBridge");

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
  const dark: boolean = themeModeOverride ? themeModeOverride === "dark" : resolveIsDark(s.themeMode);

  // Palet final (schema + mode + tone) — dikirim ke widget agar tampilan
  // widget 100% mengikuti tema aplikasi.
  const palette = resolvePalette(s.themeSchema, dark, s.tone);

  return {
    schema: 2,
    updatedAt: new Date().toISOString(),
    locale: s.lang,
    privacy: s.privacyMode,
    theme: { mode: dark ? "dark" : "light", preset: s.accent, schemaId: s.themeSchema, colors: paletteToColors(palette) },
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

function paletteToColors(p: ThemePalette) {
  return {
    bg: p.bg, surface: p.surface, surface2: p.surface2, border: p.border,
    text: p.text, textMuted: p.textMuted,
    accent: p.accent, accentContrast: p.accentContrast,
    income: p.income, expense: p.expense, warn: p.warn, bad: p.bad,
  };
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

    // 2) APK: kirim ke widget lewat plugin WidgetBridge
    if (Capacitor.isNativePlatform()) {
      try { await WidgetBridge.push({ snapshot: json }); } catch { /* widget belum siap — abaikan */ }
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