// ============================================================
// BUDGETO v3 — Settings Store (zustand + persist)
// Tema (mode, preset aksen), bahasa, periode gajian, keamanan,
// notifikasi, kredensial cloud opsional. Tersimpan di localStorage.
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
  // Tampilan (F03)
  themeMode: "light" | "dark" | "system";
  accent: string; // preset id: emerald | ocean | sunset | violet | rose | gold
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
      version: 1,
      // v0 → v1: notifikasi default mati (user nyalakan sendiri, sekaligus memicu dialog izin)
      migrate: (persisted, version) => {
        const st = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 1) st.notificationsEnabled = false;
        return st as SettingsState;
      },
    }
  )
);
