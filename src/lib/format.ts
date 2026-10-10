// ============================================================
// BUDGETO v3 — Formatting (mata uang & tanggal)
// Nominal selalu angka tabular (tabular-nums diterapkan via CSS),
// format mengikuti bahasa terpilih (Intl).
// ============================================================

import type { Lang } from "./i18n";
import { localeOf } from "./i18n";

export const CURRENCY_SYMBOL = "Rp";

export function formatMoney(amount: number, lang: Lang = "id", opts?: { compact?: boolean; signed?: boolean }): string {
  const abs = Math.abs(amount);
  const loc = localeOf(lang);
  let body: string;
  if (opts?.compact && abs >= 1_000_000_000) body = `${trimZero(abs / 1_000_000_000, loc)}${lang === "id" ? "M" : "B"}`;
  else if (opts?.compact && abs >= 1_000_000) body = `${trimZero(abs / 1_000_000, loc)}${lang === "id" ? "jt" : "M"}`;
  else if (opts?.compact && abs >= 1_000) body = `${trimZero(abs / 1_000, loc)}${lang === "id" ? "rb" : "K"}`;
  else {
    body = new Intl.NumberFormat(loc, { maximumFractionDigits: abs % 1 === 0 ? 0 : 2 }).format(abs);
  }
  const sign = amount < 0 ? "-" : opts?.signed ? "+" : "";
  return `${sign}${CURRENCY_SYMBOL}${body}`;
}

function trimZero(n: number, loc: string): string {
  const rounded = Math.round(n * 10) / 10;
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(rounded);
}

export function formatNumber(n: number, lang: Lang = "id"): string {
  return new Intl.NumberFormat(localeOf(lang)).format(n);
}

// ─── Tanggal ─────────────────────────────────────────────────
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

/** offset bulan kalender terhadap hari ini (untuk laporan 6 bulan). */
export function monthStr(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatDateLabel(dateStr: string, lang: Lang = "id", relative = true): string {
  const today = todayStr();
  if (relative && dateStr === today) return lang === "id" ? "Hari ini" : "Today";
  if (relative && dateStr === addDays(today, -1)) return lang === "id" ? "Kemarin" : "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = lang === "id"
    ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  if (y === now.getFullYear()) return `${d} ${months[m - 1]}`;
  return `${d} ${months[m - 1]} ${y}`;
}

export function dayName(dateStr: string, lang: Lang = "id"): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const names = lang === "id"
    ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[new Date(y, m - 1, d).getDay()];
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISO(dt);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function diffDays(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.round((to - from) / 86400000);
}

export function relativeTimeLabel(ts: number, lang: Lang = "id"): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const loc = localeOf(lang);
  if (min < 1) return lang === "id" ? "baru saja" : "just now";
  if (min < 60) return lang === "id" ? `${min} menit lalu` : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return lang === "id" ? `${h} jam lalu` : `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return lang === "id" ? `${d} hari lalu` : `${d} d ago`;
  return formatDateLabel(new Date(ts).toISOString().slice(0, 10), lang, false);
}

export function timeLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}
