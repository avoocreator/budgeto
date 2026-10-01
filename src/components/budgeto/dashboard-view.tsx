// ============================================================
// BUDGETO v2 — Dashboard (Beranda)
// ============================================================

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { totalBalance, monthlySummary, budgetProgress, categoryBreakdown, goalProgress } from "@/lib/stats";
import { formatMoney, monthLabel, monthStr, formatDateLabel } from "@/lib/format";
import { Card, CatIcon, EmptyState, ProgressBar, SectionTitle, Amount } from "./ui-bits";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Target, ChevronRight, Sparkles, Wallet as WalletIcon2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { View } from "./types";

export function DashboardView({ go, onEditTx }: { go: (v: View) => void; onEditTx: (tx: import("@/lib/types").Transaction) => void }) {
  const { userName, currency } = useSettings();
  const month = monthStr(0);

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const budgets = useLiveQuery(() => db.budgets.filter((b) => !b.deleted).toArray(), []);
  const goals = useLiveQuery(() => db.goals.toArray(), []);

  if (txs === undefined || wallets === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="h-52 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const balance = totalBalance(txs, wallets ?? []);
  const summary = monthlySummary(txs, month);
  const savingsRate = summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0;
  const progress = budgetProgress(txs, budgets ?? [], month).slice(0, 3);
  const breakdown = categoryBreakdown(txs, month, "expense").slice(0, 3);
  const recent = [...txs].filter((t) => !t.deleted).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const activeGoals = goalProgress(goals ?? []).filter((g) => g.status === "active").slice(0, 2);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const firstName = userName ? userName.split(" ")[0] : "Sobat Budgeto";

  return (
    <div className="space-y-4">
      {/* ── Kartu saldo utama (premium) ── */}
      <div className="anim-rise shine relative overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-700 via-emerald-500 to-teal-400 p-[18px] text-white shadow-xl shadow-emerald-600/25">
        {/* dekorasi */}
        <div aria-hidden className="dots absolute inset-0 opacity-60" />
        <div aria-hidden className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/15 blur-[2px]" />
        <div aria-hidden className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-teal-200/25 blur-sm" />
        <div aria-hidden className="absolute right-14 top-16 h-10 w-10 rounded-full bg-white/10" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-medium text-emerald-50/95">{greeting}, {firstName} 👋</p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9.5px] font-semibold tracking-wide backdrop-blur-sm">
              {monthLabel(month, true).toUpperCase()}
            </span>
          </div>
          <p className="mt-2.5 text-[11px] text-emerald-50/80">Total saldo semua dompet</p>
          <p className="tnum mt-0.5 text-[34px] font-extrabold leading-none tracking-tight drop-shadow-sm">
            {formatMoney(balance, currency)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/[0.16] px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/[0.22]">
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-50/90">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20"><ArrowUpRight size={10} /></span>
                Masuk
              </div>
              <p className="tnum mt-1 text-[15px] font-bold">{formatMoney(summary.income, currency)}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.16] px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/[0.22]">
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-emerald-50/90">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20"><ArrowDownLeft size={10} /></span>
                Keluar
              </div>
              <p className="tnum mt-1 text-[15px] font-bold">{formatMoney(summary.expense, currency)}</p>
            </div>
          </div>

          {summary.income > 0 && (
            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-black/10 py-1.5 pl-2 pr-3 text-[10.5px] font-medium text-emerald-50/95 backdrop-blur-sm">
              <Sparkles size={11} className="shrink-0 text-amber-200" />
              Kamu menabung {savingsRate}% bulan ini · {formatMoney(summary.net, currency, { compact: true })} tersisa
            </div>
          )}
        </div>
      </div>

      {/* ── Dompet ringkas ── */}
      {(wallets ?? []).length > 0 && (
        <div className="thin-scroll anim-rise d1 -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {(wallets ?? []).map((w) => (
            <button key={w.id} onClick={() => go("wallets")} className="shrink-0 text-left transition-transform duration-200 active:scale-[0.96]">
              <Card className="w-[136px] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full ring-2 ring-muted" style={{ backgroundColor: w.color }} />
                  <span className="truncate font-medium">{w.name}</span>
                </div>
                <p className="tnum mt-1.5 text-[15px] font-bold">
                  {formatMoney(require_balance(txs, w), currency, { compact: true })}
                </p>
              </Card>
            </button>
          ))}
          <button onClick={() => go("wallets")} className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary">
            <WalletIcon2 size={16} />
            <span className="text-[10px] font-medium">Dompet</span>
          </button>
        </div>
      )}

      {/* ── Budget bulan ini ── */}
      {progress.length > 0 && (
        <section className="anim-rise d2">
          <SectionTitle
            title={`Budget ${monthLabel(month, true)}`}
            action={<button onClick={() => go("budgets")} className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary">Semua <ChevronRight size={13} /></button>}
          />
          <Card className="space-y-3.5 p-4">
            {progress.map((p) => {
              const cat = categories?.find((c) => c.id === p.budget.categoryId);
              return (
                <div key={p.budget.id}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat?.color }} />
                      {cat?.name ?? "Kategori"}
                    </span>
                    <span className="tnum text-muted-foreground">
                      {formatMoney(p.spent, currency, { compact: true })} <span className="opacity-60">/ {formatMoney(p.budget.amount, currency, { compact: true })}</span>
                    </span>
                  </div>
                  <ProgressBar percent={p.percent} color={cat?.color} />
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* ── Target tabungan aktif ── */}
      {activeGoals.length > 0 && (
        <section className="anim-rise d3">
          <SectionTitle
            title="Target Tabungan"
            action={<button onClick={() => go("goals")} className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary">Semua <ChevronRight size={13} /></button>}
          />
          <div className="grid grid-cols-2 gap-2.5">
            {activeGoals.map((g) => {
              const pct = Math.min(100, Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100));
              return (
                <Card key={g.id} className="p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: `${g.color}22` }}>
                      <Target size={12} style={{ color: g.color }} />
                    </span>
                    <span className="truncate font-semibold">{g.name}</span>
                  </div>
                  <p className="tnum mt-2 text-[15px] font-bold">{formatMoney(g.currentAmount, currency, { compact: true })}</p>
                  <ProgressBar percent={pct} color={g.color} className="mt-2" />
                  <p className="mt-1.5 text-[10.5px] font-medium text-muted-foreground">{pct}% tercapai</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Transaksi terakhir ── */}
      <section className="anim-rise d4">
        <SectionTitle
          title="Transaksi Terakhir"
          action={<button onClick={() => go("transactions")} className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary">Lihat semua <ChevronRight size={13} /></button>}
        />
        {recent.length === 0 ? (
          <EmptyState icon={Sparkles} title="Belum ada transaksi" subtitle="Tekan tombol + di bawah untuk catat pengeluaran pertamamu" />
        ) : (
          <Card className="divide-y divide-border/70 p-0 overflow-hidden">
            {recent.map((t) => <TxRow key={t.id} tx={t} categories={categories ?? []} currency={currency} onClick={() => onEditTx(t)} />)}
          </Card>
        )}
      </section>

      {/* ── Top kategori ── */}
      {breakdown.length > 0 && (
        <section className="anim-rise d5">
          <SectionTitle
            title={`Pengeluaran Terbesar ${monthLabel(month)}`}
            action={<button onClick={() => go("reports")} className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary">Laporan <ChevronRight size={13} /></button>}
          />
          <div className="space-y-2">
            {breakdown.map((b, i) => {
              const cat = categories?.find((c) => c.id === b.categoryId);
              const max = breakdown[0].amount || 1;
              return (
                <Card key={b.categoryId} className="flex items-center gap-3 p-3 transition-all duration-200 hover:shadow-md">
                  <span
                    className={cn("tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold",
                      i === 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}
                  >
                    {i + 1}
                  </span>
                  <CatIcon name={cat?.icon ?? "shapes"} color={cat?.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{cat?.name ?? "Lainnya"}</p>
                    <ProgressBar percent={(b.amount / max) * 100} color={cat?.color} className="mt-1.5" />
                  </div>
                  <Amount value={b.amount} currency={currency} type="expense" className="text-xs" compact />
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function require_balance(txs: import("@/lib/types").Transaction[], w: import("@/lib/types").Wallet): number {
  let bal = w.initialBalance;
  for (const t of txs) {
    if (t.deleted) continue;
    if (t.type === "income" && t.walletId === w.id) bal += t.amount;
    else if (t.type === "expense" && t.walletId === w.id) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.walletId === w.id) bal -= t.amount;
      if (t.toWalletId === w.id) bal += t.amount;
    }
  }
  return bal;
}

export function TxRow({ tx, categories, currency, onClick }: {
  tx: import("@/lib/types").Transaction;
  categories: import("@/lib/types").Category[];
  currency: string;
  onClick?: () => void;
}) {
  const cat = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : null;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent/40 active:bg-accent/60">
      {tx.type === "transfer" ? (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/15">
          <ArrowLeftRight size={15} className="text-primary" />
        </span>
      ) : (
        <CatIcon name={cat?.icon ?? "help"} color={cat?.color ?? "#64748b"} size={16} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight">
          {tx.type === "transfer" ? "Transfer antar dompet" : cat?.name ?? "Tanpa kategori"}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatDateLabel(tx.date)}{tx.note ? ` · ${tx.note}` : ""}
        </p>
      </div>
      <span className={cn_amount(tx.type)}>
        {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
        {formatMoney(tx.amount, currency)}
      </span>
    </button>
  );
}

function cn_amount(type: string) {
  return cn(
    "tnum shrink-0 rounded-lg px-1.5 py-0.5 text-[13px] font-bold",
    type === "income" && "bg-income/10 text-income",
    type === "expense" && "text-expense"
  );
}
