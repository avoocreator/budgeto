// ============================================================
// BUDGETO v2 — Formatting (mata uang & tanggal, locale Indonesia)
// ============================================================

export function formatMoney(amount: number, currency = "IDR", opts?: { compact?: boolean; signed?: boolean }): string {
  const abs = Math.abs(amount);
  let body: string;
  if (opts?.compact && abs >= 1_000_000_000) body = `${trimZero(abs / 1_000_000_000)}M`;
  else if (opts?.compact && abs >= 1_000_000) body = `${trimZero(abs / 1_000_000)}jt`;
  else if (opts?.compact && abs >= 1_000) body = `${trimZero(abs / 1_000)}rb`;
  else {
    body = new Intl.NumberFormat("id-ID", { maximumFractionDigits: abs % 1 === 0 ? 0 : 2 }).format(abs);
  }
  const symbol = currencySymbol(currency);
  const sign = amount < 0 ? "-" : opts?.signed ? "+" : "";
  return `${sign}${symbol}${body}`;
}

function trimZero(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}

export function currencySymbol(currency: string): string {
  switch (currency) {
    case "USD": return "$";
    case "EUR": return "€";
    case "SGD": return "S$";
    case "MYR": return "RM";
    case "JPY": return "¥";
    default: return "Rp";
  }
}

export function formatCompactMoney(amount: number): string {
  return formatMoney(amount, "IDR", { compact: true });
}

// ─── Tanggal ─────────────────────────────────────────────────
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthStr(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function formatDateLabel(dateStr: string, relative = true): string {
  const today = todayStr();
  if (relative && dateStr === today) return "Hari ini";
  if (relative && dateStr === addDays(today, -1)) return "Kemarin";
  const [y, m, d] = dateStr.split("-").map(Number);
  const now = new Date();
  if (y === now.getFullYear()) return `${d} ${MONTH_NAMES[m - 1]}`;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTH_NAMES_FULL[m - 1]} ${y}`;
}

export function monthLabel(ms: string, full = false): string {
  const [y, m] = ms.split("-").map(Number);
  const names = full ? MONTH_NAMES_FULL : MONTH_NAMES;
  const now = new Date();
  return y === now.getFullYear() ? names[m - 1] : `${names[m - 1]} ${String(y).slice(2)}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function daysInMonth(ms: string): number {
  const [y, m] = ms.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function relativeTimeLabel(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return formatDateLabel(new Date(ts).toISOString().slice(0, 10), false);
}
