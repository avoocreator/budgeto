// ============================================================
// BUDGETO v3 — Sinkronisasi Cloud (Supabase, OPSIONAL — app 100% jalan offline)
// - Login email OTP; RLS memastikan tiap pengguna hanya melihat datanya
// - Delta sync berdasarkan updatedAt; soft delete (`deleted`) ikut tersync
// - Konflik: Last-Write-Wins (updatedAt terbaru menang)
// - Offline: antrean = debounce; dikirim saat koneksi kembali
// - Skema tabel mengikuti supabase-schema.sql + recurring_rules (v3)
// ============================================================

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";
import { useSettings } from "./settings";

type SyncState = "unconfigured" | "idle" | "syncing" | "ok" | "error" | "offline";
type Listener = (state: SyncState, message?: string) => void;

let client: SupabaseClient | null = null;
let clientUrl = "";
let clientKey = "";
let currentState: SyncState = "unconfigured";
let currentMessage = "";
const listeners = new Set<Listener>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

const TABLES = ["transactions", "categories", "wallets", "budgets", "goals", "recurring_rules"] as const;
type TableName = (typeof TABLES)[number];

/** pemetaan tabel Dexie ↔ tabel Supabase (recurring_rules ↔ recurringRules) */
function dexieTable(name: TableName) {
  const map = { recurring_rules: "recurringRules" } as Record<string, string>;
  return (db as unknown as Record<string, { toArray(): Promise<Record<string, unknown>[]>; put(v: Record<string, unknown>): Promise<unknown> }>)[map[name] ?? name];
}

export function getSyncState(): { state: SyncState; message: string } {
  return { state: currentState, message: currentMessage };
}

export function onSyncChange(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentState, currentMessage);
  return () => { listeners.delete(listener); };
}

function setState(state: SyncState, message = ""): void {
  currentState = state;
  currentMessage = message;
  listeners.forEach((l) => l(state, message));
}

function getClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = useSettings.getState();
  if (!supabaseUrl || !supabaseAnonKey) {
    setState("unconfigured");
    return null;
  }
  const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
  const cleanKey = supabaseAnonKey.trim();
  if (!client || clientUrl !== cleanUrl || clientKey !== cleanKey) {
    try {
      client = createClient(cleanUrl, cleanKey, { auth: { persistSession: true, autoRefreshToken: true } });
      clientUrl = cleanUrl;
      clientKey = cleanKey;
    } catch {
      setState("error", "URL/kunci Supabase tidak valid");
      return null;
    }
  }
  return client;
}

export async function sendOtp(email: string): Promise<{ ok: boolean; message: string }> {
  const c = getClient();
  if (!c) return { ok: false, message: "Isi dulu URL & anon key Supabase" };
  setState("syncing", "Mengirim kode…");
  const { error } = await c.auth.signInWithOtp({ email: email.trim().toLowerCase() });
  if (error) {
    setState("error", error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Kode 6 digit dikirim ke email kamu" };
}

export async function verifyOtp(email: string, token: string): Promise<{ ok: boolean; message: string }> {
  const c = getClient();
  if (!c) return { ok: false, message: "Konfigurasi belum lengkap" };
  const { error } = await c.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: "email" });
  if (error) {
    setState("error", error.message);
    return { ok: false, message: error.message };
  }
  void syncNow();
  return { ok: true, message: "Berhasil masuk! Sinkronisasi aktif." };
}

export async function signOutCloud(): Promise<void> {
  const c = getClient();
  if (c) await c.auth.signOut();
  setState("unconfigured");
}

export async function getSessionEmail(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

// ─── SYNC ENGINE ─────────────────────────────────────────────
async function pushTable(name: TableName, c: SupabaseClient, userId: string, since: number): Promise<void> {
  const all = await dexieTable(name).toArray();
  const rows = all
    .filter((r) => Number(r.updatedAt ?? 0) > since)
    .map((r) => ({ ...r, user_id: userId }));
  if (rows.length === 0) return;
  const { error } = await c.from(name).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`push ${name}: ${error.message}`);
}

async function pullTable(name: TableName, c: SupabaseClient, userId: string, since: number): Promise<number> {
  const { data, error } = await c
    .from(name)
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", String(since));
  if (error) throw new Error(`pull ${name}: ${error.message}`);
  if (!data || data.length === 0) return 0;
  const table = dexieTable(name);
  for (const row of data as Record<string, unknown>[]) {
    const { user_id: _u, ...rest } = row;
    await table.put(rest);
  }
  return data.length;
}

export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  if (syncing) return { ok: true, message: "Sedang sinkron" };
  const c = getClient();
  if (!c) return { ok: false, message: "Belum dikonfigurasi" };
  syncing = true;
  setState("syncing");
  try {
    if (navigator.onLine === false) {
      setState("offline");
      return { ok: false, message: "Tidak ada koneksi — antrean dikirim saat online" };
    }
    const { data } = await c.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setState("idle", "Belum login");
      syncing = false;
      return { ok: false, message: "Login dulu dengan kode email" };
    }
    const lastSync = Number(localStorage.getItem("budgeto-last-sync-v3") ?? 0);
    for (const t of TABLES) await pushTable(t, c, user.id, lastSync);
    let pulled = 0;
    for (const t of TABLES) pulled += await pullTable(t, c, user.id, lastSync);
    localStorage.setItem("budgeto-last-sync-v3", String(Date.now()));
    setState("ok");
    return { ok: true, message: pulled > 0 ? `Sinkron OK (${pulled} perubahan baru)` : "Semua data sudah tersinkron" };
  } catch (err) {
    setState("error", err instanceof Error ? err.message : "Gagal sinkron");
    return { ok: false, message: err instanceof Error ? err.message : "Gagal sinkron" };
  } finally {
    syncing = false;
  }
}

/** Debounced auto-sync setelah perubahan data (hemat kuota: hanya delta). */
export function scheduleSync(): void {
  const { cloudAutoSync, supabaseUrl, supabaseAnonKey } = useSettings.getState();
  if (!cloudAutoSync || !supabaseUrl || !supabaseAnonKey) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), 4000);
}

/** Dipanggil sekali saat app dibuka. */
export function initSync(): void {
  const { supabaseUrl, supabaseAnonKey, cloudAutoSync } = useSettings.getState();
  if (!supabaseUrl || !supabaseAnonKey) {
    setState("unconfigured");
    return;
  }
  if (cloudAutoSync) setTimeout(() => void syncNow(), 1500);
  window.addEventListener("online", () => {
    const { cloudAutoSync: auto } = useSettings.getState();
    if (auto) void syncNow();
  });
}
