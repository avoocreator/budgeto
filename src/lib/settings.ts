// ============================================================
// BUDGETO v3.1 — Settings Store (zustand + persist)
// Tema (mode, 5 schema warna, tone dingin↔hangat), bahasa, periode
// gajian, keamanan, notifikasi (termasuk notifikasi setiap aksi),
// kredensial cloud opsional. Tersimpan di localStorage.
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PeriodMode } from "./types";

export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
  length: number; // 4-6, untuk tahu kapan verifikasi dilakukan
}

export interface Settings {
  onboarded: boolean;
  // Tampilan (F03) — 5 schema warna penuh + tone
  themeMode: "light" | "dark" | "system";
  themeSchema: string; // mocha | emerald | aqua | sunset | lavender
  /** -100 (dingin) … 0 (netral) … +100 (hangat) */
  tone: number;
  /** legacy preset aksen (dipertahankan untuk kompatibilitas widget lama) */
  accent: string;
  // Bahasa (F09)
  lang: "id" | "en";
  // Periode (F05)
  periodMode: PeriodMode;
  payday: number; // 1-31
  // Keamanan (F07)
  lockEnabled: boolean;
  pin: PinRecord | null;
  autoLockDelay: 0 | 60 | 300; // detik: langsung / 1 menit / 5 menit
  biometricEnabled: boolean;
  privacyMode: boolean;
  // Notifikasi
  notificationsEnabled: boolean;
  txNotif: boolean;
  /** notifikasi sistem untuk setiap aksi: dompet, goal, budget, kategori, tagihan, backup */
  actionNotif: boolean;
  budgetAlerts: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  billReminders: boolean;
  // Cloud (opsional)
  cloudAutoSync: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  // Preferensi alur catat cepat (F02)
  lastWalletId: string;
  lastBackupAt: number;
}

interface SettingsState extends Settings {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  reset(): void;
}

const DEFAULTS: Settings = {
  onboarded: false,
  themeMode: "system",
  themeSchema: "emerald",
  tone: 0,
  accent: "emerald",
  lang: "id",
  periodMode: "calendar",
  payday: 25,
  lockEnabled: false,
  pin: null,
  autoLockDelay: 60,
  biometricEnabled: false,
  privacyMode: false,
  notificationsEnabled: false,
  txNotif: true,
  actionNotif: true,
  budgetAlerts: true,
  dailyReminder: true,
  reminderTime: "20:00",
  billReminders: true,
  cloudAutoSync: true,
  supabaseUrl: "",
  supabaseAnonKey: "",
  lastWalletId: "",
  lastBackupAt: 0,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: "budgeto-settings-v3",
      version: 2,
      // v0 → v1: notifikasi default mati (user nyalakan sendiri, sekaligus memicu dialog izin)
      // v1 → v2: preset aksen lama dipetakan ke schema tema baru + field baru
      migrate: (persisted, version) => {
        const st = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 1) st.notificationsEnabled = false;
        if (version < 2) {
          const map: Record<string, string> = {
            emerald: "emerald", ocean: "aqua", sunset: "sunset",
            violet: "lavender", rose: "lavender", gold: "sunset",
          };
          st.themeSchema = map[st.accent ?? ""] ?? "emerald";
          st.tone = 0;
          st.actionNotif = true;
        }
        return st as SettingsState;
      },
    }
  )
);
