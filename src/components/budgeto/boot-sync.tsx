// ============================================================
// BUDGETO v3.1 — Sinkronisasi tema & bahasa ke <html>
// ThemeSync:
//  - terapkan schema warna (5 schema) + tone (dingin↔hangat) sebagai
//    CSS variables inline pada <html> (sumber kebenaran: lib/themes.ts)
//  - pasang data-schema & data-accent (legacy) pada <html>
//  - mode light/dark/system → next-themes
//  - kirim ulang snapshot widget saat tema/privasi berubah
// LangSync: bahasa awal mengikuti sistem (F09) + pasang data-lang.
// ============================================================

"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useSettings } from "@/lib/settings";
import { useLang, initLangFromSystem } from "@/lib/i18n";
import { pushWidgetSnapshot } from "@/lib/widget";
import { applyPalette, resolveIsDark, resolvePalette } from "@/lib/themes";

export function AccentSync() {
  const accent = useSettings((s) => s.accent);
  const themeSchema = useSettings((s) => s.themeSchema);
  const tone = useSettings((s) => s.tone);
  const themeMode = useSettings((s) => s.themeMode);
  const privacyMode = useSettings((s) => s.privacyMode);
  const { setTheme } = useTheme();

  // Sumber kebenaran tema = settings store → terapkan ke next-themes (F03)
  useEffect(() => {
    setTheme(themeMode);
  }, [themeMode, setTheme]);

  // Terapkan palet penuh (schema + mode + tone) ke CSS variables
  useEffect(() => {
    const apply = () => {
      const dark = resolveIsDark(themeMode);
      const p = resolvePalette(themeSchema, dark, tone);
      applyPalette(p);
      document.documentElement.dataset.schema = themeSchema;
      document.documentElement.dataset.accent = themeSchema; // legacy selector
      document.documentElement.dataset.tone = String(tone);
    };
    apply();
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themeSchema, themeMode, tone]);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => void pushWidgetSnapshot();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  useEffect(() => {
    // snapshot ikut diperbarui saat schema/mode/tone/privasi berubah
    void pushWidgetSnapshot();
  }, [themeSchema, accent, themeMode, tone, privacyMode]);

  return null;
}

export function LangSync() {
  const lang = useLang((s) => s.lang);
  useEffect(() => {
    initLangFromSystem();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
