// ============================================================
// BUDGETO v3.1 — THEME ENGINE
// 5 schema warna lengkap (Mocha, Emerald, Aqua, Sunset, Lavender),
// masing-masing punya palet terang & gelap, ditambah pengatur
// tone (dingin ↔ hangat) yang mencampur tint halus ke permukaan.
//
// Satu sumber kebenaran: palet didefinisikan di sini (JS), lalu
// diterapkan sebagai CSS variables pada <html> oleh ThemeSync
// (boot-sync.tsx) dan dikirim ke widget Android lewat snapshot.
// ============================================================

export interface ThemePalette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  income: string;
  expense: string;
  warn: string;
  bad: string;
  accent: string;
  accentContrast: string;
}

export interface ThemeSchema {
  id: string;
  label: string;
  /** emoji kecil untuk picker */
  emoji: string;
  /** warna representatif untuk chip picker (mode gelap) */
  swatch: string;
  light: ThemePalette;
  dark: ThemePalette;
}

// ─── 5 SCHEMA ────────────────────────────────────────────────
export const THEME_SCHEMAS: ThemeSchema[] = [
  {
    id: "mocha",
    label: "Mocha",
    emoji: "☕",
    swatch: "#D8A679",
    light: {
      bg: "#f8f5f1", surface: "#ffffff", surface2: "#f0e9e1", border: "#e5dccd",
      text: "#2b211a", textMuted: "#8a7a6b",
      income: "#177a53", expense: "#d14b4b", warn: "#b45309", bad: "#d13d3d",
      accent: "#8b5e3c", accentContrast: "#ffffff",
    },
    dark: {
      bg: "#17120e", surface: "#211a15", surface2: "#2c231b", border: "#3a2e22",
      text: "#f0e8e0", textMuted: "#a89684",
      income: "#4ade80", expense: "#f87171", warn: "#fbbf24", bad: "#f87171",
      accent: "#d8a679", accentContrast: "#2b1a0d",
    },
  },
  {
    id: "emerald",
    label: "Emerald",
    emoji: "🌿",
    swatch: "#34D399",
    light: {
      bg: "#f6f7f6", surface: "#ffffff", surface2: "#f0f2f1", border: "#e4e8e6",
      text: "#17201c", textMuted: "#6b7570",
      income: "#059669", expense: "#e11d48", warn: "#d97706", bad: "#e11d48",
      accent: "#059669", accentContrast: "#ffffff",
    },
    dark: {
      bg: "#0d1210", surface: "#141b18", surface2: "#1c2420", border: "#253029",
      text: "#e8edea", textMuted: "#8d9993",
      income: "#34d399", expense: "#fb7185", warn: "#fbbf24", bad: "#fb7185",
      accent: "#34d399", accentContrast: "#06281c",
    },
  },
  {
    id: "aqua",
    label: "Aqua",
    emoji: "🌊",
    swatch: "#22D3EE",
    light: {
      bg: "#f3f8fa", surface: "#ffffff", surface2: "#e8f2f5", border: "#d7e7ec",
      text: "#0f2027", textMuted: "#5f7d86",
      income: "#0d9488", expense: "#e11d48", warn: "#d97706", bad: "#e11d48",
      accent: "#0e7490", accentContrast: "#ffffff",
    },
    dark: {
      bg: "#0a1216", surface: "#101c21", surface2: "#182830", border: "#223740",
      text: "#e2f0f4", textMuted: "#83a3ad",
      income: "#2dd4bf", expense: "#fb7185", warn: "#fbbf24", bad: "#fb7185",
      accent: "#22d3ee", accentContrast: "#08252b",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    emoji: "🌅",
    swatch: "#FB923C",
    light: {
      bg: "#faf5f2", surface: "#ffffff", surface2: "#f5ebe4", border: "#ecdcd0",
      text: "#2a1c14", textMuted: "#8d7466",
      income: "#0f8a5f", expense: "#dc2626", warn: "#d97706", bad: "#dc2626",
      accent: "#ea580c", accentContrast: "#ffffff",
    },
    dark: {
      bg: "#160f0b", surface: "#211712", surface2: "#2c1f18", border: "#3a2a1f",
      text: "#f4eae2", textMuted: "#ab8f7d",
      income: "#34d399", expense: "#f87171", warn: "#fbbf24", bad: "#f87171",
      accent: "#fb923c", accentContrast: "#2b1505",
    },
  },
  {
    id: "lavender",
    label: "Lavender",
    emoji: "💜",
    swatch: "#A78BFA",
    light: {
      bg: "#f7f5fb", surface: "#ffffff", surface2: "#efeaf7", border: "#e1daf0",
      text: "#221c30", textMuted: "#7a7091",
      income: "#0f8a5f", expense: "#e11d48", warn: "#d97706", bad: "#e11d48",
      accent: "#7c3aed", accentContrast: "#ffffff",
    },
    dark: {
      bg: "#100d17", surface: "#191423", surface2: "#231c31", border: "#312845",
      text: "#ece8f6", textMuted: "#9d92ba",
      income: "#34d399", expense: "#fb7185", warn: "#fbbf24", bad: "#fb7185",
      accent: "#a78bfa", accentContrast: "#1d1240",
    },
  },
];

export const DEFAULT_SCHEMA = "emerald";

/** Rentang tone: -100 (dingin/cool) … 0 (netral) … +100 (hangat/warm). */
export type Tone = number;

export function getSchema(id: string): ThemeSchema {
  return THEME_SCHEMAS.find((s) => s.id === id) ?? THEME_SCHEMAS[1];
}

// ─── UTIL WARNA ──────────────────────────────────────────────
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const f = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}

/** Campur hex a dengan hex b sebanyak pct (0–1). */
export function mixHex(a: string, b: string, pct: number): string {
  try {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    return rgbToHex(r1 + (r2 - r1) * pct, g1 + (g2 - g1) * pct, b1 + (b2 - b1) * pct);
  } catch {
    return a;
  }
}

/** Warna dengan alpha hex di depan, mis. tintHex("#fff", 0.2) → "#33FFFFFF". */
export function alphaHex(hex: string, alpha: number): string {
  const a = Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, "0").toUpperCase();
  const h = hex.toUpperCase();
  return `#${a}${h}`;
}

// ─── TONE (dingin ↔ hangat) ──────────────────────────────────
const WARM_TINT = "#ff9a56"; // oranye hangat
const COOL_TINT = "#58a6ff"; // biru sejuk

/** Kekuatan tint maksimum 14% — cukup terasa tanpa merusak keterbacaan. */
const TONE_MAX = 0.14;

/** Terapkan tone ke satu warna. tone>0 hangat, tone<0 dingin. */
export function toned(hex: string, tone: Tone): string {
  const t = clamp(tone, -100, 100);
  if (t === 0) return hex;
  const strength = (Math.abs(t) / 100) * TONE_MAX;
  return mixHex(hex, t > 0 ? WARM_TINT : COOL_TINT, strength);
}

/**
 * Palet final = palet schema (light/dark) + tone yang diterapkan ke
 * permukaan (bg, surface, surface2, border). Warna teks & aksen
 * dibiarkan murni agar kontras tetap terjaga.
 */
export function resolvePalette(schemaId: string, dark: boolean, tone: Tone): ThemePalette {
  const base = getSchema(schemaId)[dark ? "dark" : "light"];
  return {
    bg: toned(base.bg, tone),
    surface: toned(base.surface, tone),
    surface2: toned(base.surface2, tone),
    border: toned(base.border, tone),
    text: base.text,
    textMuted: base.textMuted,
    income: base.income,
    expense: base.expense,
    warn: base.warn,
    bad: base.bad,
    accent: base.accent,
    accentContrast: base.accentContrast,
  };
}

/** Terapkan palet sebagai CSS variables pada <html> (dipakai ThemeSync). */
export function applyPalette(p: ThemePalette): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.setProperty("--bg", p.bg);
  el.style.setProperty("--surface", p.surface);
  el.style.setProperty("--surface-2", p.surface2);
  el.style.setProperty("--border-t", p.border);
  el.style.setProperty("--text", p.text);
  el.style.setProperty("--text-muted", p.textMuted);
  el.style.setProperty("--income", p.income);
  el.style.setProperty("--expense", p.expense);
  el.style.setProperty("--status-ok", p.income);
  el.style.setProperty("--status-warn", p.warn);
  el.style.setProperty("--status-bad", p.bad);
  el.style.setProperty("--accent-t", p.accent);
  el.style.setProperty("--accent-contrast-t", p.accentContrast);
}

/** Mode gelap efektif dari settings (dipakai ThemeSync & widget). */
export function resolveIsDark(mode: "light" | "dark" | "system"): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Label & deskripsi tone untuk UI pengaturan. */
export function toneLabel(tone: Tone, lang: "id" | "en"): string {
  const t = clamp(tone, -100, 100);
  if (t <= -60) return lang === "id" ? "Sangat dingin" : "Very cool";
  if (t < -15) return lang === "id" ? "Dingin" : "Cool";
  if (t <= 15) return lang === "id" ? "Netral" : "Neutral";
  if (t < 60) return lang === "id" ? "Hangat" : "Warm";
  return lang === "id" ? "Sangat hangat" : "Very warm";
}
