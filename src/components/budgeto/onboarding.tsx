// ============================================================
// BUDGETO v3 — Onboarding (alur A, user-flow.md)
// 1) Tanggal gajian (boleh pakai bulan kalender) — dilewati boleh
// 2) Dompet pertama + saldo awal
// 3) Budget periode (opsional)
// 4) PIN opsional
// Melewati semua langkah tetap menghasilkan app yang bisa dipakai.
// ============================================================

"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useLang } from "@/lib/i18n";
import { saveWallet, saveBudget } from "@/lib/repo";
import { db } from "@/lib/db";
import { hashPin } from "@/lib/lock";
import { currentPeriod, periodLabel } from "@/lib/period";
import { pushWidgetSnapshot } from "@/lib/widget";
import { PALETTE } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./ui-bits";
import { Wallet, CalendarDays, Gauge, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export function Onboarding() {
  const set = useSettings((s) => s.set);
  const lang = useLang((s) => s.lang);
  const id = lang === "id";

  const [step, setStep] = useState(0);
  const [periodMode, setPeriodMode] = useState<"calendar" | "payday">("payday");
  const [payday, setPayday] = useState(25);
  const [walletName, setWalletName] = useState(id ? "Uang Tunai" : "Cash");
  const [walletBalance, setWalletBalance] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const totalSteps = 4;

  const finish = async () => {
    setBusy(true);
    try {
      set("periodMode", periodMode);
      set("payday", payday);
      // dompet pertama: buat bila belum ada; bila sudah (seed default),
      // terapkan nama & saldo awal yang diketik ke dompet pertama
      const wallets = await db.wallets.filter((w) => !w.deleted).toArray();
      if (wallets.length === 0 && walletName.trim()) {
        await saveWallet({ name: walletName, icon: "banknote", color: PALETTE[0], initialBalance: Number(walletBalance) || 0 });
        const created = (await db.wallets.toArray())[0];
        if (created) set("lastWalletId", created.id);
      } else if (wallets.length > 0 && (walletName.trim() || Number(walletBalance) > 0)) {
        const first = wallets[0];
        await db.wallets.put({
          ...first,
          name: walletName.trim() || first.name,
          initialBalance: Number(walletBalance) || first.initialBalance,
          updatedAt: Date.now(),
        });
        set("lastWalletId", first.id);
      }
      // budget awal: buat untuk kategori umum? — simpan global via kategori pertama
      if (Number(budgetAmount) > 0) {
        const cats = await db.categories.filter((c) => !c.deleted && c.type === "expense").toArray();
        if (cats[0]) await saveBudget({ categoryId: cats[0].id, amount: Number(budgetAmount) });
      }
      // PIN
      if (pin.length >= 4) {
        const record = await hashPin(pin);
        set("lockEnabled", true);
        set("pin", record);
        set("autoLockDelay", 60);
      }
      set("onboarded", true);
      void pushWidgetSnapshot();
    } finally {
      setBusy(false);
    }
  };

  const next = () => (step < totalSteps - 1 ? setStep(step + 1) : void finish());

  const steps = [
    // ── 0: Welcome + payday ──
    {
      icon: <CalendarDays size={22} />,
      title: id ? "Kapan tanggal gajianmu?" : "When is your payday?",
      desc: id ? "Budget & laporan dihitung dari tanggal ini. Bisa diganti nanti." : "Budgets & reports count from this date. Changeable later.",
      body: (
        <div className="space-y-3">
          <Segmented
            value={periodMode}
            onChange={setPeriodMode}
            options={[
              { value: "payday", label: id ? "Tanggal gajian" : "Payday" },
              { value: "calendar", label: id ? "Bulan kalender" : "Calendar" },
            ]}
          />
          {periodMode === "payday" && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPayday((p) => Math.max(1, p - 1))} className="h-11 w-11 rounded-2xl bg-surface2 text-lg font-extrabold">−</button>
              <div className="flex h-11 w-24 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">{payday}</div>
              <button onClick={() => setPayday((p) => Math.min(31, p + 1))} className="h-11 w-11 rounded-2xl bg-surface2 text-lg font-extrabold">+</button>
            </div>
          )}
          <p className="rounded-xl bg-surface2 p-3 text-center text-[11px] font-semibold text-muted-foreground">
            {id ? "Periode sekarang" : "Current period"}: <span className="text-primary">{periodLabel(currentPeriod(periodMode, payday), lang)}</span>
          </p>
        </div>
      ),
    },
    // ── 1: Dompet pertama ──
    {
      icon: <Wallet size={22} />,
      title: id ? "Buat dompet pertamamu" : "Create your first wallet",
      desc: id ? "Bisa tunai, bank, atau e-wallet. Bisa tambah lagi nanti." : "Cash, bank, or e-wallet. You can add more later.",
      body: (
        <div className="space-y-2.5">
          <input
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            placeholder={id ? "mis. Uang Tunai" : "e.g. Cash"}
            className="w-full rounded-xl bg-surface2 px-3.5 py-3 text-sm font-semibold outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
          />
          <input
            value={walletBalance}
            onChange={(e) => setWalletBalance(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder={id ? "Saldo awal (boleh 0)" : "Initial balance (0 is fine)"}
            className="w-full rounded-xl bg-surface2 px-3.5 py-3 text-sm font-bold outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
          />
        </div>
      ),
    },
    // ── 2: Budget ──
    {
      icon: <Gauge size={22} />,
      title: id ? "Berapa budgetmu per periode?" : "What's your budget per period?",
      desc: id ? "Perkiraan belanja harianmu dihitung dari angka ini. Bisa dilewati." : "Your daily allowance is computed from this. You can skip it.",
      body: (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rp</span>
          <input
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="0"
            className="w-full rounded-xl bg-surface2 py-3 pl-10 pr-3.5 text-sm font-extrabold outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
          />
          {Number(budgetAmount) > 0 && periodLabel(currentPeriod(periodMode, payday), lang) && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              ≈ Rp{new Intl.NumberFormat("id-ID").format(Math.floor(Number(budgetAmount) / 30))} / {id ? "hari" : "day"}
            </p>
          )}
        </div>
      ),
    },
    // ── 3: PIN opsional ──
    {
      icon: <ShieldCheck size={22} />,
      title: id ? "Lindungi dengan PIN?" : "Protect with a PIN?",
      desc: id ? "Opsional — bisa diaktifkan lagi di Pengaturan." : "Optional — you can enable it later in Settings.",
      body: (
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          type="password"
          placeholder={id ? "PIN 4–6 digit (kosongkan bila tidak)" : "4–6 digit PIN (empty to skip)"}
          className="w-full rounded-xl bg-surface2 px-3.5 py-3 text-center text-sm font-extrabold tracking-[0.35em] outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
        />
      ),
    },
  ];

  const step0 = step === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+36px)]">
      {/* Logo */}
      {step0 && (
        <div className="anim-rise flex flex-col items-center pb-4 pt-6 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primary to-primary/60 text-2xl font-black text-primary-foreground shadow-lg">
            B
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {id ? "Selamat datang di Budgeto" : "Welcome to Budgeto"}
          </h1>
          <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            {id ? "Catat keuanganmu dengan cepat, offline, dan tanpa akun." : "Track your money fast, offline, no account needed."}
          </p>
        </div>
      )}

      {/* Progress */}
      <div className="flex gap-1.5 pb-5 pt-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
        ))}
      </div>

      {/* Konten langkah */}
      <div key={step} className="anim-rise flex-1">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">{steps[step].icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{id ? `Langkah ${step + 1}` : `Step ${step + 1}`}</p>
            <h2 className="text-lg font-extrabold leading-tight tracking-tight">{steps[step].title}</h2>
          </div>
        </div>
        <p className="pb-4 text-[13px] leading-relaxed text-muted-foreground">{steps[step].desc}</p>
        {steps[step].body}
      </div>

      {/* Tombol */}
      <div className="space-y-2 pt-4">
        <button
          onClick={next}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {step === totalSteps - 1 ? <Sparkles size={16} /> : <ArrowRight size={16} />}
          {busy ? "…" : step === totalSteps - 1 ? (id ? "Mulai pakai" : "Start using") : (id ? "Lanjut" : "Next")}
        </button>
        <button onClick={next} className="w-full py-2 text-center text-xs font-bold text-muted-foreground">
          {step0 ? (id ? "Lewati, pakai bulan kalender" : "Skip, use calendar months") : (id ? "Lewati langkah ini" : "Skip this step")}
        </button>
      </div>
    </div>
  );
}
