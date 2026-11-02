"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { db } from "@/lib/db";
import { computeDailyRemaining, totalBalance, walletBalance, periodSummary } from "@/lib/money";
import { currentPeriod, shiftPeriod } from "@/lib/period";
import { formatDateLabel, todayStr } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { useLang, localeOf, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Period, Transaction, Category, Wallet } from "@/lib/types";
import { Card, MoneyText, ProgressBar, EmptyState, IconBubble, AnimatedMoney, MoneyHero, Delta } from "./ui-bits";
import type { View } from "./types";
import {
  ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight,
  Minus, Plus, Wallet as WalletIcon, Wallet2, PiggyBank,
} from "lucide-react";

// Helper
function monthShort(date: string, lang: Lang): string {
  const [y, m] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), { month: "short" }).format(new Date(y, m - 1, 1));
}

/** "1 Nov – 30 Nov" (tanpa tahun, muat di pill kecil). */
function periodShort(p: Period, lang: Lang): string {
  const sd = Number(p.start.split("-")[2]);
  const ed = Number(p.end.split("-")[2]);
  return `${sd} ${monthShort(p.start, lang)} – ${ed} ${monthShort(p.end, lang)}`;
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [ty, tm, td] = todayStr().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/** Persen perubahan; null bila periode pembanding kosong (tidak bisa dibandingkan). */
function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Label sumbu Y ringkas: 0, 500rb, 1,5jt … */
function axisMoney(v: number, lang: Lang): string {
  if (v === 0) return "0";
  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(".", lang === "id" ? "," : ".");
  if (v >= 1_000_000_000) return `${trim(v / 1_000_000_000)}${lang === "id" ? "M" : "B"}`;
  if (v >= 1_000_000) return `${trim(v / 1_000_000)}${lang === "id" ? "jt" : "M"}`;
  if (v >= 1_000) return `${trim(v / 1_000)}${lang === "id" ? "rb" : "K"}`;
  return String(v);
}

interface TrendPoint { label: string; range: string; income: number; expense: number }
type FlowSeries = "expense" | "income";

// Dashboard
export function DashboardView({
  go, onEditTx, onAdd,
}: {
  go: (v: View) => void;
  onEditTx: (tx: Transaction) => void;
  onAdd: (type: "expense" | "income") => void;
}) {
  const lang = useLang((s) => s.lang);
  const id = lang === "id";
  const periodMode = useSettings((s) => s.periodMode);
  const payday = useSettings((s) => s.payday);
  const [series, setSeries] = useState<FlowSeries>("expense");
  const [picked, setPicked] = useState<number | null>(null);

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const budgets = useLiveQuery(() => db.budgets.filter((b) => !b.deleted).toArray(), []);
  const rules = useLiveQuery(() => db.recurringRules.filter((r) => !r.deleted && r.active).toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted && g.status !== "archived").toArray(), []);

  if (txs === undefined || wallets === undefined) {
    return (
      <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
        <div className="h-[300px] animate-pulse rounded-[20px] bg-surface2 lg:col-span-5 lg:row-span-2 lg:h-[460px]" />
        <div className="h-[104px] animate-pulse rounded-[20px] bg-surface2 lg:col-span-7" />
        <div className="h-[240px] animate-pulse rounded-[20px] bg-surface2 lg:col-span-7" />
      </div>
    );
  }

  const allBudgets = budgets ?? [];
  const allRules = rules ?? [];
  const allCats = cats ?? [];
  const allGoals = goals ?? [];

  const period = currentPeriod(periodMode, payday);
  const prevPeriod = shiftPeriod(period, -1, periodMode, payday);
  const daily = computeDailyRemaining({ txs, budgets: allBudgets, rules: allRules, period });
  const balance = totalBalance(txs, wallets);
  const cur = periodSummary(txs, period);
  const prev = periodSummary(txs, prevPeriod);
  const net = cur.income - cur.expense;

  const totalBudget = daily.periodBudget;
  const usedPct = totalBudget > 0 ? (daily.spent / totalBudget) * 100 : 0;

  const statusColor = daily.ready
    ? daily.status === "ok" ? "text-ok" : daily.status === "warn" ? "text-warn" : "text-bad"
    : "text-muted-foreground";
  const statusChip = daily.ready
    ? daily.status === "ok" ? "bg-ok/10 text-ok" : daily.status === "warn" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad"
    : "";
  const statusLabel = daily.ready
    ? ({
        ok: id ? "Aman" : "On track",
        warn: id ? "Hati-hati" : "Careful",
        bad: id ? "Lewat budget" : "Over budget",
      }[daily.status])
    : "";

  // dompet: 4 pertama tampil di kartu saldo
  const walletRows = wallets.map((w) => ({ w, bal: walletBalance(w.id, txs, wallets) }));
  const shownWallets = walletRows.slice(0, 4);
  const hiddenWallets = Math.max(0, walletRows.length - shownWallets.length);
  const walletName = new Map<string, string>(wallets.map((w: Wallet) => [w.id, w.name]));

  // arus kas 6 periode terakhir (periode berjalan = batang paling kanan)
  const trend: TrendPoint[] = Array.from({ length: 6 }, (_, i) => {
    const p = shiftPeriod(period, i - 5, periodMode, payday);
    const s = periodSummary(txs, p);
    return { label: monthShort(p.end, lang), range: periodShort(p, lang), income: s.income, expense: s.expense };
  });
  const hasFlow = trend.some((t) => t.income > 0 || t.expense > 0);
  const activeIdx = picked ?? trend.length - 1;
  const activePoint = trend[activeIdx];

  const recent = txs
    .filter((t) => !t.deleted)
    .sort((a, b) => (b.date + String(b.createdAt)).localeCompare(a.date + String(a.createdAt)))
    .slice(0, 6);
  const upcoming = allRules
    .filter((r) => !r.deleted && r.active)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 3);

  const goalsSaved = allGoals.reduce((s, g) => s + g.currentAmount, 0);
  const goalsTarget = allGoals.reduce((s, g) => s + g.targetAmount, 0);
  const goalsPct = goalsTarget > 0 ? Math.min(100, (goalsSaved / goalsTarget) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-3 pb-2 lg:grid-cols-12 lg:gap-4">
      {/* Total saldo dan dompet */}
      <Card className="anim-rise flex flex-col p-5 lg:col-span-5 lg:row-span-2 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface2 text-primary">
              <WalletIcon size={18} strokeWidth={2} />
            </span>
            <p className="text-[14px] font-semibold">{id ? "Total saldo" : "Total balance"}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <CalendarDays size={12} />
            {periodShort(period, lang)}
          </span>
        </div>

        <MoneyHero amount={balance} className="mt-6" size={44} />

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", net >= 0 ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad")}>
            {net >= 0 ? <ArrowUpRight size={12} strokeWidth={2.4} /> : <ArrowDownRight size={12} strokeWidth={2.4} />}
            <MoneyText amount={Math.abs(net)} compact />
          </span>
          <span className="text-muted-foreground">{id ? "selisih masuk − keluar periode ini" : "net in − out this period"}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => onAdd("expense")}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground transition-opacity active:opacity-85"
          >
            <Minus size={16} strokeWidth={2.4} />
            {id ? "Catat keluar" : "Add expense"}
          </button>
          <button
            onClick={() => onAdd("income")}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface2 text-[13px] font-semibold text-foreground transition-colors active:bg-border"
          >
            <Plus size={16} strokeWidth={2.4} />
            {id ? "Catat masuk" : "Add income"}
          </button>
        </div>

        {/* Dompet */}
        <div className="mt-auto pt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">{id ? "Dompet saya" : "My wallets"}</h2>
            <LinkBtn onClick={() => go("wallets")}>
              {hiddenWallets > 0 ? (id ? `Kelola (+${hiddenWallets})` : `Manage (+${hiddenWallets})`) : (id ? "Kelola" : "Manage")}
            </LinkBtn>
          </div>
          {shownWallets.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {shownWallets.map(({ w, bal }) => (
                <div key={w.id} className="rounded-2xl bg-surface2 p-3.5">
                  <div className="flex items-center gap-2">
                    <IconBubble name={w.icon} color={w.color} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">{w.name}</span>
                  </div>
                  <MoneyText amount={bal} compact={Math.abs(bal) >= 1_000_000_000} className="mt-3 block truncate text-[16px] font-semibold tracking-tight" />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground">{id ? "Belum ada dompet" : "No wallets yet"}</p>
          )}
        </div>
      </Card>

      {/* Ringkasan periode */}
      <div className="anim-rise d1 grid grid-cols-2 gap-3 lg:col-span-7 lg:grid-cols-3 lg:gap-4">
        <FlowStat
          kind="income"
          label={id ? "Pemasukan" : "Income"}
          amount={cur.income}
          delta={pctChange(cur.income, prev.income)}
          vs={id ? "vs periode lalu" : "vs last period"}
        />
        <FlowStat
          kind="expense"
          label={id ? "Pengeluaran" : "Expenses"}
          amount={cur.expense}
          delta={pctChange(cur.expense, prev.expense)}
          vs={id ? "vs periode lalu" : "vs last period"}
        />
        <Card className="col-span-2 p-4 lg:col-span-1">
          {daily.ready ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-muted-foreground">{id ? "Sisa aman / hari" : "Safe to spend / day"}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", statusChip)}>{statusLabel}</span>
              </div>
              <AnimatedMoney amount={daily.amount} compact={daily.amount >= 100_000_000} className={cn("mt-3 block text-[20px] font-semibold leading-none tracking-tight", statusColor)} />
              {totalBudget > 0 ? (
                <div className="mt-3">
                  <ProgressBar percent={usedPct} className="h-1.5" />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {Math.round(usedPct)}% {id ? "budget terpakai" : "of budget used"} · {id ? `${daily.remainingDays} hari lagi` : `${daily.remainingDays} days left`}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">{id ? `${daily.remainingDays} hari lagi` : `${daily.remainingDays} days left`}</p>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">{id ? "Sisa aman / hari" : "Safe to spend / day"}</p>
                <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                  {id ? "Atur budget & tanggal gajian untuk melihatnya." : "Set a budget & payday to see it."}
                </p>
              </div>
              <button
                onClick={() => go("budgets")}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-surface2 px-3 py-1.5 text-[12px] font-semibold active:bg-border"
              >
                {id ? "Atur" : "Set up"} <ArrowRight size={13} />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Arus kas */}
      <Card className="anim-rise d2 p-4 lg:col-span-7 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">{id ? "Arus kas" : "Cash flow"}</h2>
            {hasFlow && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {activePoint.range} ·{" "}
                <MoneyText amount={activePoint[series]} className="font-semibold text-foreground" />
              </p>
            )}
          </div>
          <div className="inline-flex rounded-xl bg-surface2 p-1 text-[12px] font-semibold" role="tablist">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={series === k}
                onClick={() => setSeries(k)}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition-colors",
                  series === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k === "expense" ? (id ? "Keluar" : "Out") : (id ? "Masuk" : "In")}
              </button>
            ))}
          </div>
        </div>

        {hasFlow ? (
          <div className="mt-4 h-[200px] lg:h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="flow-active" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: series === "income" ? "var(--primary)" : "var(--text)", stopOpacity: 0.95 }} />
                    <stop offset="100%" style={{ stopColor: series === "income" ? "var(--primary)" : "var(--text)", stopOpacity: 0.12 }} />
                  </linearGradient>
                  <linearGradient id="flow-idle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: series === "income" ? "var(--primary)" : "var(--text)", stopOpacity: 0.28 }} />
                    <stop offset="100%" style={{ stopColor: series === "income" ? "var(--primary)" : "var(--text)", stopOpacity: 0.03 }} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="var(--border-t)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={38}
                  tickCount={5}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  tickFormatter={(v: number) => axisMoney(v, lang)}
                />
                <Bar
                  dataKey={series}
                  radius={[10, 10, 3, 3]}
                  maxBarSize={44}
                  onMouseEnter={(_: unknown, i: number) => setPicked(i)}
                  onClick={(_: unknown, i: number) => setPicked(i)}
                >
                  {trend.map((d, i) => (
                    <Cell key={d.label + i} fill={i === activeIdx ? "url(#flow-active)" : "url(#flow-idle)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-surface2 px-3 py-10 text-center text-[12px] text-muted-foreground">
            {id ? "Grafik muncul setelah ada transaksi" : "The chart appears once you have transactions"}
          </p>
        )}
      </Card>

      {/* Transaksi terakhir */}
      <Card className="anim-rise d3 p-4 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-3 lg:p-5">
        <CardHeader
          title={id ? "Transaksi terakhir" : "Recent transactions"}
          action={<LinkBtn onClick={() => go("transactions")}>{id ? "Lihat semua" : "See all"}</LinkBtn>}
        />
        {recent.length > 0 ? (
          <>
            {/* HP: daftar */}
            <div className="mt-3 divide-y lg:hidden">
              {recent.slice(0, 5).map((t) => <TxRow key={t.id} tx={t} cats={allCats} onEdit={() => onEditTx(t)} flat />)}
            </div>
            {/* Desktop: tabel */}
            <div className="mt-4 hidden lg:block">
              <div className="grid grid-cols-[2.2fr_1.2fr_1fr_1fr_1fr] gap-3 rounded-xl bg-surface2 px-3.5 py-2.5 text-[11px] font-medium text-muted-foreground">
                <span>{id ? "Aktivitas" : "Activity"}</span>
                <span>{id ? "Kategori" : "Category"}</span>
                <span>{id ? "Dompet" : "Wallet"}</span>
                <span>{id ? "Tanggal" : "Date"}</span>
                <span className="text-right">{id ? "Jumlah" : "Amount"}</span>
              </div>
              <div className="divide-y">
                {recent.map((t) => (
                  <TxTableRow key={t.id} tx={t} cats={allCats} walletName={walletName} onEdit={() => onEditTx(t)} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <EmptyState
              icon={<Wallet2 size={20} />}
              title={id ? "Belum ada transaksi" : "No transactions yet"}
              desc={id ? "Tekan tombol + untuk mencatat yang pertama" : "Tap + to record your first one"}
            />
          </div>
        )}
      </Card>

      {/* Target tabungan */}
      <Card className="anim-rise d4 p-4 lg:col-span-5 lg:col-start-1 lg:row-start-3 lg:p-5">
        <CardHeader
          title={id ? "Target tabungan" : "Savings goals"}
          action={<LinkBtn onClick={() => go("goals")}>{id ? "Kelola" : "Manage"}</LinkBtn>}
        />
        {allGoals.length > 0 ? (
          <>
            <div className="mt-3 flex items-baseline justify-between gap-3 rounded-2xl bg-surface2 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{id ? "Total terkumpul" : "Total saved"}</p>
                <MoneyText amount={goalsSaved} className="mt-0.5 block truncate text-[18px] font-semibold tracking-tight" />
              </div>
              <span className="shrink-0 text-[12px] font-semibold text-primary">{Math.round(goalsPct)}%</span>
            </div>
            <div className="mt-3 space-y-3.5">
              {allGoals.slice(0, 3).map((g) => {
                const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <IconBubble name={g.icon} color={g.color} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold">{g.name}</p>
                        <span className="text-[12px] font-semibold">{Math.round(pct)}%</span>
                      </div>
                      <ProgressBar percent={pct} className="mt-1.5 h-1.5" />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        <MoneyText amount={g.currentAmount} compact /> / <MoneyText amount={g.targetAmount} compact />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <EmptyState
              icon={<PiggyBank size={20} />}
              title={id ? "Belum ada target" : "No goals yet"}
              desc={id ? "Buat target untuk mulai menabung terarah" : "Create a goal to start saving with purpose"}
              action={
                <button onClick={() => go("goals")} className="mt-1 rounded-lg bg-surface2 px-3 py-1.5 text-[12px] font-semibold active:bg-border">
                  {id ? "Buat target" : "Create goal"}
                </button>
              }
            />
          </div>
        )}
      </Card>

      {/* Tagihan terdekat */}
      <Card className="anim-rise d5 p-4 lg:col-span-5 lg:col-start-1 lg:row-start-4 lg:p-5">
        <CardHeader
          title={id ? "Tagihan terdekat" : "Upcoming bills"}
          action={<LinkBtn onClick={() => go("bills")}>{id ? "Kelola" : "Manage"}</LinkBtn>}
        />
        {upcoming.length > 0 ? (
          <div className="mt-3 divide-y">
            {upcoming.map((r) => {
              const n = daysUntil(r.nextDate);
              const when = n < 0 ? (id ? "terlambat" : "overdue") : n === 0 ? (id ? "hari ini" : "today") : id ? `${n} hari lagi` : `in ${n} days`;
              return (
                <div key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <IconBubble name="calendar-clock" color="var(--status-warn)" size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{r.name}</p>
                    <p className={cn("text-[11px]", n <= 1 ? "font-medium text-warn" : "text-muted-foreground")}>
                      {formatDateLabel(r.nextDate, lang, false)} · {when}
                    </p>
                  </div>
                  <MoneyText amount={r.amount} className="text-[13px] font-semibold" />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-muted-foreground">{id ? "Tidak ada tagihan menunggu" : "No pending bills"}</p>
        )}
      </Card>
    </div>
  );
}

// Komponen pendukung
function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-0.5 text-[12px] font-semibold text-primary">
      {children} <ChevronRight size={14} />
    </button>
  );
}

function FlowStat({
  kind, label, amount, delta, vs,
}: { kind: "income" | "expense"; label: string; amount: number; delta: number | null; vs: string }) {
  const income = kind === "income";
  const Arrow = income ? ArrowDownLeft : ArrowUpRight;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in srgb, ${income ? "var(--income)" : "var(--expense)"} 12%, transparent)`,
            color: income ? "var(--income)" : "var(--expense)",
          }}
        >
          <Arrow size={15} strokeWidth={2.3} />
        </span>
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      </div>
      <AnimatedMoney amount={amount} compact={amount >= 100_000_000} className="mt-3 block text-[20px] font-semibold leading-none tracking-tight" />
      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {delta !== null ? <Delta value={delta} goodWhenUp={income} /> : <span className="text-[11px] text-muted-foreground">—</span>}
        <span className="text-[11px] text-muted-foreground">{vs}</span>
      </div>
    </Card>
  );
}

// Baris tabel transaksi desktop
function TxTableRow({
  tx, cats, walletName, onEdit,
}: { tx: Transaction; cats: Category[]; walletName: Map<string, string>; onEdit: () => void }) {
  const lang = useLang((s) => s.lang);
  const isTransfer = tx.type === "transfer";
  const income = tx.type === "income";
  const cat = tx.categoryId ? cats.find((c) => c.id === tx.categoryId) : null;
  const typeLabel = income
    ? (lang === "id" ? "Pemasukan" : "Income")
    : isTransfer
      ? (lang === "id" ? "Transfer" : "Transfer")
      : (lang === "id" ? "Pengeluaran" : "Expense");
  const title = tx.note || cat?.name || typeLabel;
  const wallet = walletName.get(tx.walletId) ?? "—";
  return (
    <button
      type="button"
      onClick={onEdit}
      className="grid w-full grid-cols-[2.2fr_1.2fr_1fr_1fr_1fr] items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface2/60"
    >
      <span className="flex min-w-0 items-center gap-3">
        <IconBubble
          name={isTransfer ? "trending" : cat?.icon ?? "shapes"}
          color={isTransfer ? "var(--text-muted)" : cat?.color ?? "#64748b"}
          size={32}
        />
        <span className="truncate text-[13px] font-semibold">{title}</span>
      </span>
      <span className="truncate text-[12px] text-muted-foreground">{isTransfer ? typeLabel : cat?.name ?? typeLabel}</span>
      <span className="truncate text-[12px] text-muted-foreground">{wallet}</span>
      <span className="truncate text-[12px] text-muted-foreground">{formatDateLabel(tx.date, lang)}</span>
      <span className={cn("flex items-center justify-end text-[13px] font-semibold", income ? "text-income" : isTransfer ? "text-muted-foreground" : "text-foreground")}>
        {income ? "+" : isTransfer ? "" : "−"}
        <MoneyText amount={tx.amount} />
      </span>
    </button>
  );
}

// Baris transaksi
export function TxRow({
  tx, cats, onEdit, flat,
}: { tx: Transaction; cats: Category[]; onEdit?: () => void; flat?: boolean }) {
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
  const sub = tx.note ? (isTransfer ? typeLabel : cat?.name ?? typeLabel) : typeLabel;
  return (
    <button
      onClick={onEdit}
      type="button"
      className={cn(
        "flex w-full items-center gap-3 text-left transition-colors",
        flat ? "py-3 first:pt-0 last:pb-0" : "rounded-2xl border bg-card p-3 hover:bg-accent/40",
      )}
    >
      <IconBubble
        name={isTransfer ? "trending" : cat?.icon ?? "shapes"}
        color={isTransfer ? "var(--text-muted)" : cat?.color ?? "#64748b"}
        size={38}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {sub}{flat ? ` · ${formatDateLabel(tx.date, lang)}` : ""}
        </p>
      </div>
      <span className={cn("flex items-center text-[13px] font-semibold", income ? "text-income" : isTransfer ? "text-muted-foreground" : "text-foreground")}>
        {income ? "+" : isTransfer ? "" : "−"}
        <MoneyText amount={tx.amount} />
      </span>
    </button>
  );
}
