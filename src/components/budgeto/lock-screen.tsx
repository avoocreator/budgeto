// ============================================================
// BUDGETO v3 — Layar kunci (F07)
// Papan PIN; gagal beberapa kali tetap bisa coba lagi (fallback
// pemulihan lewat alur "Lupa PIN" di Pengaturan).
// Isi app tidak dirender di bawahnya (gate di AppShell).
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useLock, verifyPin } from "@/lib/lock";
import { cn } from "@/lib/utils";
import { Delete, ShieldCheck } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function LockScreen() {
  const pinRecord = useSettings((s) => s.pin);
  const unlock = useLock((s) => s.unlock);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);

  // Verifikasi via effect (kebal batching klik cepat); setState di callback
  // async, bukan langsung di body effect.
  useEffect(() => {
    if (!pinRecord || checking || wrong) return;
    if (input.length !== pinRecord.length) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const ok = await verifyPin(input, pinRecord);
        if (cancelled) return;
        if (ok) {
          unlock();
        } else {
          setWrong(true);
          setTimeout(() => { setWrong(false); setInput(""); setChecking(false); }, 550);
        }
      })();
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [input, pinRecord, checking, wrong, unlock]);

  const press = (k: string) => {
    if (checking) return;
    if (k === "del") {
      setInput((s) => s.slice(0, -1));
      return;
    }
    if (k === "") return;
    setInput((s) => (s + k).slice(0, 6));
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-8">
      <div className={cn("flex flex-col items-center", wrong && "animate-pulse")}>
        <span className={cn("flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/12 text-primary", wrong && "bg-bad/12 text-bad")}>
          <ShieldCheck size={28} />
        </span>
        <h1 className="pt-4 text-lg font-extrabold tracking-tight">Budgeto</h1>
        <p className={cn("mt-1 text-xs font-semibold", wrong ? "text-bad" : "text-muted-foreground")}>
          {wrong ? "PIN salah" : "Masukkan PIN"}
        </p>

        {/* Titik PIN */}
        <div className="flex gap-2.5 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={cn("h-2.5 w-2.5 rounded-full transition-all",
                i < input.length ? (wrong ? "scale-110 bg-bad" : "scale-110 bg-primary") : "bg-border")}
            />
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-[280px] grid-cols-3 gap-2.5">
        {KEYS.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={k === ""}
            aria-label={k === "del" ? "Hapus" : k}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl text-xl font-bold transition-transform active:scale-95",
              k === "" ? "opacity-0" : "bg-surface2 text-foreground hover:bg-border/50"
            )}
          >
            {k === "del" ? <Delete size={20} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
