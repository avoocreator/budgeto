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
  themeMode: "light" | "dark" | "system";
  themeSchema: string;
  tone: number;
  accent: string;
  lang: "id" | "en";
  periodMode: PeriodMode;
  payday: number;
  lockEnabled: boolean;
  pin: PinRecord | null;
  autoLockDelay: 0 | 60 | 300;
  biometricEnabled: boolean;
  privacyMode: boolean;
  notificationsEnabled: boolean;
  txNotif: boolean;
  actionNotif: boolean;
  budgetAlerts: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  billReminders: boolean;
  cloudAutoSync: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
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
