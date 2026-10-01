// ============================================================
// BUDGETO v2 — Sinkronisasi Cloud (Supabase, GRATIS, opsional)
// - Login pakai email OTP (aman, tiap user hanya lihat datanya — RLS)
// - Last-Write-Wins berdasarkan updatedAt
// - Auto sync: saat app dibuka & setiap transaksi (debounce 4 detik)
// ============================================================

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";
import type { AppData } from "./types";
import { useSettings } from "./settings";

type SyncState = "idle" | "syncing" | "ok" | "error" | "offline" | "unconfigured";
type Listener = (state: SyncState, message?: string) => void;

let client: SupabaseClient | null = null;
let clientUrl = "";
let clientKey = "";
let currentState: SyncState = "unconfigured";
let currentMessage = "";
const listeners = new Set<Listener>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

export function getSyncState(): { state: SyncState; message: string } {
  return { state: currentState, message: currentMessage };
}

export function onSyncChange(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentState, currentMessage);
  return () => listeners.delete(listener);
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
      client = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
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
  setState("syncing", "Mengirim kode...");
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
  const { data } = await c.auth.getSession();
  return data.session?.user?.email ?? null;
}

// ─── SYNC ENGINE ─────────────────────────────────────────────
const TABLES = ["transactions", "categories", "wallets", "budgets", "goals", "settings"] as const;
type TableName = (typeof TABLES)[number];

async function pushTable(name: TableName, c: SupabaseClient, userId: string): Promise<void> {
  let rows: Record<string, unknown>[] = [];
  if (name === "settings") {
    rows = (await db.settings.toArray()).map((s) => ({ ...s, user_id: userId }));
  } else {
    rows = ((await (db as unknown as Record<string, { toArray(): Promise<Record<string, unknown>[]> }>)[name].toArray()) as Record<string, unknown>[]).map(
      (r) => ({ ...r, user_id: userId })
    );
  }
  if (rows.length === 0) return;
  const { error } = await c.from(name).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`push ${name}: ${error.message}`);
}

/** Sinkron ringkasan untuk widget Android (tabel widget_summary, PK user_id). */
async function pushWidgetSummary(c: SupabaseClient, userId: string): Promise<void> {
  const { totalBalance, monthlySummary } = await import("./stats");
  const { monthStr } = await import("./format");
  const [txs, wallets] = await Promise.all([db.transactions.toArray(), db.wallets.toArray()]);
  const month = monthStr(0);
  const s = monthlySummary(txs, month);

  // Ambil token widget yang sudah ada di cloud (jangan sampai tertimpa)
  const { data: existing } = await c
    .from("widget_summary")
    .select("widget_token")
    .eq("user_id", userId)
    .maybeSingle();

  let token = existing?.widget_token as string | undefined;
  if (!token) {
    token = localStorage.getItem("budgeto-widget-token") ?? crypto.randomUUID();
    localStorage.setItem("budgeto-widget-token", token);
  }

  const row = {
    user_id: userId,
    balance: totalBalance(txs, wallets),
    month_income: s.income,
    month_expense: s.expense,
    widget_token: token,
    updated_at: new Date().toISOString(),
  };
  const { error } = await c.from("widget_summary").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`push widget_summary: ${error.message}`);
  localStorage.setItem("budgeto-widget-token", token);
}

export async function getWidgetToken(): Promise<string | null> {
  return localStorage.getItem("budgeto-widget-token");
}

async function pullTable(name: TableName, c: SupabaseClient, userId: string, since: number): Promise<number> {
  const { data, error } = await c
    .from(name)
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", new Date(since).toISOString());
  if (error) throw new Error(`pull ${name}: ${error.message}`);
  if (!data || data.length === 0) return 0;

  const localTable = (db as unknown as Record<string, { put(v: Record<string, unknown>): Promise<unknown> }>)[name];
  for (const row of data as Record<string, unknown>[]) {
    const { user_id: _u, ...rest } = row;
    // Konversi updated_at ISO → epoch agar konsisten dgn lokal
    if (typeof rest.updatedAt === "string") rest.updatedAt = new Date(rest.updatedAt).getTime();
    if (typeof rest.createdAt === "string") rest.createdAt = new Date(rest.createdAt).getTime();
    await localTable.put(rest);
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
      return { ok: false, message: "Tidak ada koneksi internet" };
    }
    const { data } = await c.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setState("idle", "Belum login");
      syncing = false;
      return { ok: false, message: "Login dulu dengan kode email" };
    }
    const lastSync = Number(localStorage.getItem("budgeto-last-sync") ?? 0);

    // PUSH dulu (data lokal → cloud)
    for (const t of TABLES) await pushTable(t, c, user.id);
    await pushWidgetSummary(c, user.id);

    // PULL (perubahan dari perangkat lain → lokal)
    let pulled = 0;
    for (const t of TABLES) pulled += await pullTable(t, c, user.id, lastSync);

    localStorage.setItem("budgeto-last-sync", String(Date.now()));
    setState("ok", pulled > 0 ? `${pulled} perubahan diterima` : "");
    return { ok: true, message: pulled > 0 ? `Sinkron OK (${pulled} perubahan baru)` : "Semua data sudah tersinkron" };
  } catch (err) {
    setState("error", err instanceof Error ? err.message : "Gagal sinkron");
    return { ok: false, message: err instanceof Error ? err.message : "Gagal sinkron" };
  } finally {
    syncing = false;
  }
}

/** Debounced auto-sync setelah perubahan data */
export function scheduleSync(): void {
  const { cloudAutoSync, supabaseUrl, supabaseAnonKey } = useSettings.getState();
  if (!cloudAutoSync || !supabaseUrl || !supabaseAnonKey) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), 4000);
}

/** Dipanggil sekali saat app dibuka */
export function initSync(): void {
  const { supabaseUrl, supabaseAnonKey, cloudAutoSync } = useSettings.getState();
  if (!supabaseUrl || !supabaseAnonKey) {
    setState("unconfigured");
    return;
  }
  if (cloudAutoSync) {
    // delay kecil agar app load dulu
    setTimeout(() => void syncNow(), 1500);
  }
  window.addEventListener("online", () => {
    const { cloudAutoSync: auto } = useSettings.getState();
    if (auto) void syncNow();
  });
}

/** Cek status login (untuk UI settings) */
export async function checkAuthState(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}
