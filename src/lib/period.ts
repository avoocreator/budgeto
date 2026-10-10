// ============================================================
// BUDGETO v3 — Periode sesuai tanggal gajian (F05)
// - mode "calendar": 1 s/d akhir bulan (perilaku lama)
// - mode "payday": mulai tanggal X (1–31) sampai sehari sebelum X bulan berikut
// - Tanggal 29–31 aman: jika bulan lebih pendek, jatuh ke hari terakhir bulan
//   (contoh gajian 31 → periode Feb 28/29 s/d Mar 30).
// - Sisa hari minimal 1 agar tidak pernah membagi dengan nol.
// ============================================================

import type { Period, PeriodMode } from "./types";
import { toISO, todayStr, daysInMonth } from "./format";

function ymd(s: string): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}

/** Tanggal "efektif" payday pada bulan tertentu: clamp 29–31 ke akhir bulan. */
export function effectivePayday(year: number, month1to12: number, payday: number): number {
  const dim = daysInMonth(year, month1to12);
  return Math.min(Math.max(1, payday), dim);
}

function dateAt(year: number, month1to12: number, day: number): string {
  return toISO(new Date(year, month1to12 - 1, day));
}

function addMonths(y: number, m: number, delta: number): [number, number] {
  const total = y * 12 + (m - 1) + delta;
  return [Math.floor(total / 12), (total % 12) + 1];
}

/**
 * Periode yang memuat `date`.
 * mode payday: jika day >= payday (efektif pada bulan tsb) → periode mulai payday bulan itu;
 *              jika day < payday → periode mulai payday bulan sebelumnya.
 */
export function periodForDate(date: string, mode: PeriodMode, payday: number): Period {
  const [y, m, d] = ymd(date);
  if (mode === "calendar") {
    return { start: dateAt(y, m, 1), end: dateAt(y, m, daysInMonth(y, m)) };
  }
  const eff = effectivePayday(y, m, payday);
  let startY = y, startM = m;
  if (d >= eff) {
    // masih dalam periode yang dimulai bulan ini
  } else {
    [startY, startM] = addMonths(y, m, -1);
  }
  const [endY, endM] = addMonths(startY, startM, 1);
  const start = dateAt(startY, startM, effectivePayday(startY, startM, payday));
  const end = dateAt(endY, endM, effectivePayday(endY, endM, payday) - 1);
  return { start, end };
}

export function currentPeriod(mode: PeriodMode, payday: number, today: string = todayStr()): Period {
  return periodForDate(today, mode, payday);
}

/** Periode bergeser n langkah dari periode acuan (untuk laporan & navigasi). */
export function shiftPeriod(base: Period, offset: number, mode: PeriodMode, payday: number): Period {
  if (offset === 0) return base;
  const anchor = offset > 0 ? nextDay(base.end) : prevDay(base.start);
  const p = periodForDate(anchor, mode, payday);
  return shiftPeriod(p, offset > 0 ? offset - 1 : offset + 1, mode, payday);
}

export function nextDay(s: string): string {
  const [y, m, d] = ymd(s);
  return toISO(new Date(y, m - 1, d + 1));
}

export function prevDay(s: string): string {
  const [y, m, d] = ymd(s);
  return toISO(new Date(y, m - 1, d - 1));
}

/** Jumlah hari dalam periode (inklusif). */
export function periodLength(p: Period): number {
  const [sy, sm, sd] = ymd(p.start);
  const [ey, em, ed] = ymd(p.end);
  const a = new Date(sy, sm - 1, sd).getTime();
  const b = new Date(ey, em - 1, ed).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

/** Hari yang sudah berlalu dalam periode (inklusif hari ini). */
export function elapsedDays(p: Period, today: string = todayStr()): number {
  const [sy, sm, sd] = ymd(p.start);
  const [ty, tm, td] = ymd(today);
  const a = new Date(sy, sm - 1, sd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.min(Math.max(0, Math.round((b - a) / 86400000) + 1), periodLength(p));
}

/** Sisa hari (minimal 1 — larangan pembagian nol di F01). */
export function remainingDays(p: Period, today: string = todayStr()): number {
  const total = periodLength(p);
  const elapsed = elapsedDays(p, today);
  const left = total - Math.min(elapsed, total);
  return Math.max(left, 1);
}

/** Label "25 Sep – 24 Okt" sesuai bahasa. */
export function periodLabel(p: Period, lang: "id" | "en"): string {
  const months = lang === "id"
    ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [sy, sm, sd] = ymd(p.start);
  const [ey, em, ed] = ymd(p.end);
  const sameY = sy === ey;
  const startTxt = `${sd} ${months[sm - 1]}${sameY ? "" : " " + sy}`;
  const endTxt = `${ed} ${months[em - 1]} ${ey}`;
  return `${startTxt} – ${endTxt}`;
}

/** Pratinjau periode saat pengaturan diganti (alur E). */
export function previewPeriod(mode: PeriodMode, payday: number): Period {
  return currentPeriod(mode, payday);
}
