// ============================================================
// BUDGETO v2 — Settings Store (zustand + localStorage persist)
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  userName: string;
  currency: string;
  notificationsEnabled: boolean;
  txNotif: boolean; // notifikasi tiap transaksi dicatat
  budgetAlerts: boolean; // peringatan budget 80% & 100%
  dailyReminder: boolean; // pengingat catat keuangan harian
  reminderTime: string; // "HH:MM"
  cloudAutoSync: boolean;
  // Cloud (Supabase) — diisi lewat UI Settings, bukan kode
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface SettingsState extends Settings {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  reset(): void;
}

const DEFAULTS: Settings = {
  userName: "",
  currency: "IDR",
  notificationsEnabled: true,
  txNotif: true,
  budgetAlerts: true,
  dailyReminder: true,
  reminderTime: "20:00",
  cloudAutoSync: true,
  supabaseUrl: "",
  supabaseAnonKey: "",
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "budgeto-settings" }
  )
);
