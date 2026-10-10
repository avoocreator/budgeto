// ============================================================
// BUDGETO v3 — Sinkronisasi atribut html (tema & bahasa)
// AccentSync: pasang data-accent pada <html> (F03) + kirim ulang
// snapshot widget saat tema berubah (tech-stack.md 2.4).
// LangSync: bahasa awal mengikuti sistem (F09) + pasang data-lang.
// ============================================================

"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useSettings } from "@/lib/settings";
import { useLang, initLangFromSystem } from "@/lib/i18n";
import { pushWidgetSnapshot } from "@/lib/widget";

export function AccentSync() {
  const accent = useSettings((s) => s.accent);
  const themeMode = useSettings((s) => s.themeMode);
  const privacyMode = useSettings((s) => s.privacyMode);
  const { setTheme } = useTheme();

  // Sumber kebenaran tema = settings store → terapkan ke next-themes (F03)
  useEffect(() => {
    setTheme(themeMode);
  }, [themeMode, setTheme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => void pushWidgetSnapshot();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  useEffect(() => {
    // snapshot ikut diperbarui saat mode/preset/privasi berubah
    void pushWidgetSnapshot();
  }, [accent, themeMode, privacyMode]);

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
