// ============================================================
// BUDGETO v3 — Dashboard "sisa harian" (F01)
// 1 angka utama per layar: sisa uang aman dipakai per hari.
// Warna status ok/warn/bad; ketuk untuk rincian hitungan.
// Di bawahnya: progress budget, saldo/in/out, tagihan terdekat,
// transaksi terakhir. Mode privasi menyembunyikan angka (F07).
// ============================================================

"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { computeDailyRemaining, totalBalance, budgetProgressList, type BudgetProgress } from "@/lib/money";
import { currentPeriod, periodLabel } from "@/lib/period";
import { useSettings } from "@/lib/settings";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card, MoneyText, SectionTitle, ProgressBar, EmptyState, PrivacyToggle, IconBubble } from "./ui-bits";
import { Icon } from "./icons";
import type { View } from "./types";
import { ArrowRight, ChevronRight, Info, CalendarClock, PiggyBank, TrendingUp, TrendingDown, Wallet2 } from "lucide-react";

const STATUS_TEXT = { ok: "statusOk", warn: "statusWarn", bad: "statusBad" } as const;

export function DashboardView({ go, onEditTx }: { go: (v: View) => void; onEditTx: (tx: import("@/lib/types").Transaction) => void }) {
  const lang = useLang((s) => s.lang);
  const periodMode = useSettings((s) => s.periodMode);
  const payday = useSettings((s) => s.payday);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const budgets = useLiveQuery(() => db.budgets.filter((b) => !b.deleted).toArray(), []);
  const rules = useLiveQuery(() => db.recurringRules.filter((r) => !r.deleted && r.active).toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);

  const loading = txs === undefined || wallets === undefined;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-3xl bg-surface2" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface2" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface2" />
      </div>
    );
  }

  const period = currentPeriod(periodMode, payday);
  const daily = computeDailyRemaining({ txs: txs ?? [], budgets: budgets ?? [], rules: rules ?? [], period });
  const balance = totalBalance(txs ?? [], wallets ?? []);
  const progresses: BudgetProgress[] = (budgets ?? []).length > 0 ? budgetProgressList(budgets ?? [], txs ?? [], period) : [];
  const totalBudget = progresses.reduce((s, p) => s + p.budget.amount, 0);
  const usedPct = totalBudget > 0 ? (daily.spent / totalBudget) * 100 : 0;
  const periodIncome = (txs ?? []).filter((t) => !t.deleted && t.type === "income" && t.date >= period.start && t.date <= period.end).reduce((s, t) => s + t.amount, 0);

  const statusColor = daily.ready
    ? daily.status === "ok" ? "text-ok" : daily.status === "warn" ? "text-warn" : "text-bad"
    : "text-muted-foreground";
  const statusChip = daily.ready
    ? daily.status === "ok" ? "bg-ok/12 text-ok" : daily.status === "warn" ? "bg-warn/12 text-warn" : "bg-bad/12 text-bad"
    : "";
  const statusLabel = daily.ready ? ({ ok: "Aman", warn: "Hati-hati", bad: "Lewat budget" }[daily.status]) : "";

  const recent = (txs ?? []).filter((t) => !t.deleted).sort((a, b) => (b.date + String(b.createdAt)).localeCompare(a.date + String(a.createdAt))).slice(0, 4);
  const upcoming = (rules ?? []).filter((r) => !r.deleted && r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 3);

  return (
    <div className="space-y-4 pb-2">
      {/* ── ANGKA UTAMA: sisa harian ── */}
      <Card className="relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-primary/8 blur-2xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">
              {daily.ready ? (lang === "id" ? "Sisa aman per hari" : "Safe to spend / day") : lang === "id" ? "Sisa harian" : "Daily allowance"}
            </p>
            <PrivacyToggle />
          </div>

          {daily.ready ? (
            <button className="mt-1.5 text-left" onClick={() => setShowBreakdown((v) => !v)} aria-expanded={showBreakdown}>
              <div className="flex items-end gap-2">
                <MoneyText amount={daily.amount} className={cn("text-[42px] font-extrabold leading-none", statusColor)} />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold", statusChip)}>
                  {statusLabel}
                </span>
                · {lang === "id" ? "sampai" : "until"} {periodLabel(period, lang).split("–")[1]?.trim()}
                <Info size={11} className="opacity-60" />
              </p>
            </button>
          ) : (
            <div className="mt-3">
              <p className="max-w-[260px] text-sm font-semibold leading-relaxed">
                {lang === "id" ? "Atur budget & tanggal gajian untuk melihat sisa harianmu" : "Set a budget & payday to see your daily allowance"}
              </p>
              <button
                onClick={() => go("budgets")}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                {lang === "id" ? "Atur sekarang" : "Set it up"} <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Rincian hitungan (alur D) */}
          {showBreakdown && daily.ready && (
            <div className="anim-rise mt-3 space-y-1.5 rounded-2xl bg-surface2/70 p-3 text-[11px] leading-relaxed">
              <Row label={lang === "id" ? "Sisa budget periode" : "Remaining period budget"} value={daily.remainingBudget} />
              {daily.upcomingBills > 0 && (
                <Row label={lang === "id" ? "Tagihan belum jatuh tempo" : "Upcoming bills"} value={-daily.upcomingBills} />
              )}
              <div className="my-1 border-t border-border/60" />
              <Row label={lang === "id" ? `Dibagi ${daily.remainingDays} hari lagi` : `Divided by ${daily.remainingDays} days left`} value={daily.amount} bold />
            </div>
          )}
        </div>
      </Card>

      {/* ── Progress budget periode ── */}
      {totalBudget > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-bold">{lang === "id" ? "Progress budget" : "Budget progress"}</p>
            <p className="text-xs font-semibold text-muted-foreground">{Math.round(usedPct)}%</p>
          </div>
          <ProgressBar percent={usedPct} />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <MoneyText amount={daily.spent} className="font-semibold text-foreground/80" />
            <span>{lang === "id" ? "dari" : "of"} <MoneyText amount={totalBudget} className="font-semibold text-foreground/80" /></span>
          </div>
        </Card>
      )}

      {/* ── Ringkasan: saldo, in, out ── */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label={lang === "id" ? "Saldo" : "Balance"} amount={balance} icon="wallet" tint="var(--text)" />
        <MiniStat label={lang === "id" ? "Masuk" : "In"} amount={periodIncome} icon="trending-up" tint="var(--income)" />
        <MiniStat label={lang === "id" ? "Keluar" : "Out"} amount={daily.spent} icon="trending-down" tint="var(--expense)" />
      </div>

      {/* ── Tagihan terdekat ── */}
      <section>
        <SectionTitle
          action={
            <button onClick={() => go("bills")} className="flex items-center gap-0.5 text-[11px] font-bold text-primary">
              {lang === "id" ? "Kelola" : "Manage"} <ChevronRight size={12} />
            </button>
          }
        >
          {lang === "id" ? "Tagihan terdekat" : "Upcoming bills"}
        </SectionTitle>
        {upcoming.length > 0 ? (
          <div className="space-y-1.5">
            {upcoming.map((r) => (
              <Card key={r.id} className="flex items-center gap-2.5 p-3">
                <IconBubble name="calendar-clock" color="var(--status-warn)" size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "id" ? "Jatuh tempo" : "Due"} {r.nextDate.split("-").reverse().join("/")}
                  </p>
                </div>
                <MoneyText amount={r.amount} className="text-[13px] font-bold" />
              </Card>
            ))}
          </div>
        ) : (
          <p className="px-1 text-[11px] text-muted-foreground">{lang === "id" ? "Tidak ada tagihan menunggu" : "No pending bills"}</p>
        )}
      </section>

      {/* ── Transaksi terakhir ── */}
      <section>
        <SectionTitle
          action={
            <button onClick={() => go("transactions")} className="flex items-center gap-0.5 text-[11px] font-bold text-primary">
              {lang === "id" ? "Lihat semua" : "See all"} <ChevronRight size={12} />
            </button>
          }
        >
          {lang === "id" ? "Transaksi terakhir" : "Recent transactions"}
        </SectionTitle>
        {recent.length > 0 ? (
          <div className="space-y-1.5">
            {recent.map((t) => <TxRow key={t.id} tx={t} cats={cats ?? []} onEdit={() => onEditTx(t)} />)}
          </div>
        ) : (
          <EmptyState
            icon={<Wallet2 size={20} />}
            title={lang === "id" ? "Belum ada transaksi" : "No transactions yet"}
            desc={lang === "id" ? "Tekan tombol + untuk mencatat yang pertama" : "Tap + to record your first one"}
          />
        )}
      </section>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <MoneyText amount={value} className={cn("text-foreground", bold && "font-extrabold")} />
    </div>
  );
}

function MiniStat({ label, amount, icon, tint }: { label: string; amount: number; icon: string; tint: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 pb-1">
        <Icon name={icon} size={12} style={{ color: tint }} />
        <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <MoneyText amount={amount} className="text-[15px] font-extrabold" compact />
    </Card>
  );
}

export function TxRow({ tx, cats, onEdit }: { tx: import("@/lib/types").Transaction; cats: import("@/lib/types").Category[]; onEdit?: () => void }) {
  const lang = useLang((s) => s.lang);
  const isTransfer = tx.type === "transfer";
  const cat = tx.categoryId ? cats.find((c) => c.id === tx.categoryId) : null;
  const income = tx.type === "income";
  const typeLabel = income
    ? (lang === "id" ? "Pemasukan" : "Income")
    : isTransfer
      ? (lang === "id" ? "Transfer antar dompet" : "Wallet transfer")
      : (lang === "id" ? "Pengeluaran" : "Expense");
  const title = tx.note || cat?.name || typeLabel;
  return (
    <button onClick={onEdit} type="button" className="flex w-full items-center gap-2.5 rounded-2xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/40">
      <IconBubble
        name={isTransfer ? "trending" : cat?.icon ?? "shapes"}
        color={isTransfer ? "var(--text-muted)" : cat?.color ?? "#64748b"}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {tx.note ? (isTransfer ? typeLabel : cat?.name ?? typeLabel) : typeLabel}
        </p>
      </div>
      <span className={cn("flex items-center gap-0.5 text-[13px] font-extrabold", income ? "text-income" : isTransfer ? "text-foreground" : "text-expense")}>
        {income ? "+" : isTransfer ? "" : "−"}
        <MoneyText amount={tx.amount} />
      </span>
    </button>
  );
}
