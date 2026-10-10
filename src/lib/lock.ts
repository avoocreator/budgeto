// ============================================================
// BUDGETO v3 — Kunci app & mode privasi (F07)
// - PIN di-hash PBKDF2 (WebCrypto) dengan salt acak; TIDAK pernah
//   tersimpan polos di IndexedDB/localStorage.
// - Kunci saat app dibuka dan saat kembali dari latar belakang
//   setelah jeda (autoLockDelay: 0 / 60 / 300 detik).
// - Mode privasi: angka tampil sebagai •••• di dashboard (widget ikut
//   lewat snapshot.privacy).
// - Lupa PIN: jalur pemulihan satu-satunya adalah hapus semua data
//   (konsekuensinya dijelaskan di UI sebelum pengguna melanjutkan).
// ============================================================

"use client";

import { create } from "zustand";
import { useSettings, type PinRecord } from "./settings";

const enc = new TextEncoder();

export async function hashPin(pin: string, saltHex?: string, iterations = 100_000): Promise<PinRecord> {
  const salt = saltHex ?? randomHex(16);
  const subtle = crypto.subtle;
  const keyMaterial = await subtle.importKey("raw", enc.encode(`budgeto:${pin}`), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { salt, hash: bytesToHex(new Uint8Array(bits)), iterations, length: pin.length };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const candidate = await hashPin(pin, record.salt, record.iterations);
  return constantEqual(candidate.hash, record.hash);
}

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToHex(arr);
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function constantEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface LockState {
  locked: boolean;
  hiddenAt: number | null;
  attempts: number;
  lock: () => void;
  unlock: () => void;
  onHidden: () => void;
  onVisible: () => void;
  resetAttempts: () => void;
}

export const useLock = create<LockState>()((set, get) => ({
  locked: false,
  hiddenAt: null,
  attempts: 0,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false, attempts: 0 }),
  onHidden: () => set({ hiddenAt: Date.now() }),
  onVisible: () => {
    const { lockEnabled, autoLockDelay } = useSettings.getState();
    if (!lockEnabled) return;
    const { hiddenAt, locked } = get();
    if (locked) return;
    if (hiddenAt === null) return;
    const elapsed = (Date.now() - hiddenAt) / 1000;
    if (elapsed >= autoLockDelay) set({ locked: true });
    set({ hiddenAt: null });
  },
  resetAttempts: () => set({ attempts: 0 }),
}));

/** Dipasang sekali di AppShell: kunci saat pertama buka (jika aktif) + pantau visibilitas. */
export function installLockWatch(): () => void {
  const { lockEnabled } = useSettings.getState();
  if (lockEnabled) useLock.getState().lock();
  const onVis = () => {
    if (document.hidden) useLock.getState().onHidden();
    else useLock.getState().onVisible();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => document.removeEventListener("visibilitychange", onVis);
}
