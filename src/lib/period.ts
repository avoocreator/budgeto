import type { Period, PeriodMode } from "./types";
import { toISO, todayStr, daysInMonth } from "./format";

function ymd(s: string): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}

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

export function periodForDate(date: string, mode: PeriodMode, payday: number): Period {
  const [y, m, d] = ymd(date);
  if (mode === "calendar") {
    return { start: dateAt(y, m, 1), end: dateAt(y, m, daysInMonth(y, m)) };
  }
  const eff = effectivePayday(y, m, payday);
  let startY = y, startM = m;
  if (d < eff) {
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

export function periodLength(p: Period): number {
  const [sy, sm, sd] = ymd(p.start);
  const [ey, em, ed] = ymd(p.end);
  const a = new Date(sy, sm - 1, sd).getTime();
  const b = new Date(ey, em - 1, ed).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

export function elapsedDays(p: Period, today: string = todayStr()): number {
  const [sy, sm, sd] = ymd(p.start);
  const [ty, tm, td] = ymd(today);
  const a = new Date(sy, sm - 1, sd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.min(Math.max(0, Math.round((b - a) / 86400000) + 1), periodLength(p));
}

export function remainingDays(p: Period, today: string = todayStr()): number {
  const total = periodLength(p);
  const elapsed = elapsedDays(p, today);
  const left = total - Math.min(elapsed, total);
  return Math.max(left, 1);
}

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

export function previewPeriod(mode: PeriodMode, payday: number): Period {
  return currentPeriod(mode, payday);
}
