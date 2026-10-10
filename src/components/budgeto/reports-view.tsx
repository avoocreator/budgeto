// ============================================================
// BUDGETO v2 — Laporan & Analisis (chart compact)
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { monthlyTrend, categoryBreakdown, dailyActivity, computeInsights } from "@/lib/stats";
import { monthLabel, monthStr, formatMoney, formatDateFull } from "@/lib/format";
import { Card, CatIcon, EmptyState, SectionTitle } from "./ui-bits";
import { TrendingUp, TrendingDown, Flame, CalendarClock, PieChart as PieIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportsView() {
  const currency = useSettings((s) => s.currency);
  const [month, setMonth] = useState(monthStr(0));

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);

  const trend = useMemo(() => monthlyTrend(txs ?? [], 6).map((t) => ({
    ...t,
    label: monthLabel(t.month),
    incomeR: t.income, expenseR: t.expense,
  })), [txs]);

  const breakdown = useMemo(() => categoryBreakdown(txs ?? [], month, "expense"), [txs, month]);
  const donut = useMemo(() => breakdown.slice(0, 6).map((b) => {
    const cat = categories?.find((c) => c.id === b.categoryId);
    return { name: cat?.name ?? "Lainnya", value: b.amount, color: cat?.color ?? "#64748b" };
  }), [breakdown, categories]);

  const daily = useMemo(() => dailyActivity(txs ?? [], month).map((d) => ({
    ...d, label: String(Number(d.date.slice(8))),
  })), [txs, month]);

  const insights = useMemo(() => computeInsights(txs ?? [], categories ?? [], month), [txs, categories, month]);

  const months = useMemo(() => {
    const set = new Set((txs ?? []).filter((t) => !t.deleted).map((t) => t.date.slice(0, 7)));
    set.add(monthStr(0));
    return [...set].sort().reverse().slice(0, 24);
  }, [txs]);

  const chipCls = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-all duration-150 active:scale-95",
      active
        ? "border-primary bg-gradient-to-r from-emerald-600 to-teal-500 font-bold text-white shadow-sm shadow-emerald-600/25"
        : "border-border bg-card text-muted-foreground hover:bg-muted"
    );

  if (txs === undefined) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  const totalExpense = breakdown.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      {/* Pilih bulan */}
      <div className="anim-rise thin-scroll flex gap-2 overflow-x-auto pb-1">
        {months.map((m) => (
          <button key={m} onClick={() => setMonth(m)} className={chipCls(month === m)}>
            {monthLabel(m, m === monthStr(0))}
          </button>
        ))}
      </div>

      {/* Tren 6 bulan */}
      <section>
        <SectionTitle title="Tren 6 Bulan" />
        <Card>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={2} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--income)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--income)" stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--expense)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--expense)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={4} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.4, radius: 8 }}
                  contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                  formatter={(value: number | string, name: string) => [
                    formatMoney(Number(value), currency),
                    name === "income" ? "Masuk" : "Keluar",
                  ]}
                />
                <Bar dataKey="income" name="income" fill="url(#gradIncome)" radius={[5, 5, 3, 3]} maxBarSize={16} />
                <Bar dataKey="expense" name="expense" fill="url(#gradExpense)" radius={[5, 5, 3, 3]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-income" /> Pemasukan</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-expense" /> Pengeluaran</span>
          </div>
        </Card>
      </section>

      {/* Komposisi kategori */}
      <section>
        <SectionTitle title={`Komposisi ${monthLabel(month, true)}`} />
        {donut.length === 0 ? (
          <EmptyState icon={PieIcon} title="Belum ada pengeluaran" subtitle={`Belum ada data pengeluaran untuk ${monthLabel(month, true)}`} />
        ) : (
          <Card>
            <div className="flex items-center gap-2">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={40} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                      {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                      formatter={(value: number | string, name: string) => [formatMoney(Number(value), currency), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {donut.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
                    <span className="tnum font-medium">{Math.round((d.value / (totalExpense || 1)) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* Aktivitas harian */}
      <section>
        <SectionTitle title={`Aktivitas Harian ${monthLabel(month)}`} />
        <Card>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                  labelFormatter={(l: string | number) => `Tanggal ${l}`}
                  formatter={(value: number | string, name: string) => [
                    formatMoney(Number(value), currency),
                    name === "expense" ? "Keluar" : "Masuk",
                  ]}
                />
                <Line type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Insight */}
      <section>
        <SectionTitle title="Insight" />
        <div className="grid grid-cols-2 gap-2.5">
          <InsightCard
            icon={Flame}
            tint="var(--expense)"
            title="Rata-rata per hari"
            value={formatMoney(insights.avgDailySpend, currency)}
            sub={`${insights.expenseCount}x pengeluaran`}
          />
          <InsightCard
            icon={CalendarClock}
            tint="oklch(0.65 0.14 200)"
            title="Proyeksi akhir bulan"
            value={formatMoney(insights.projectedMonthEnd, currency)}
            sub="kalau pola sama terus"
          />
          {insights.biggestExpense && (
            <InsightCard
              icon={TrendingDown}
              tint="oklch(0.65 0.15 55)"
              title="Pengeluaran terbesar"
              value={formatMoney(insights.biggestExpense.amount, currency)}
              sub={insights.biggestExpense.note || formatDateFull(insights.biggestExpense.date)}
              className="col-span-2"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function InsightCard({ icon: Icon, tint, title, value, sub, className }: {
  icon: typeof TrendingUp; tint: string; title: string; value: string; sub: string; className?: string;
}) {
  return (
    <Card className={cn("p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: `${tint}1f` }}>
          <Icon size={11} style={{ color: tint }} />
        </span>
        {title}
      </div>
      <p className="tnum mt-1.5 text-[17px] font-extrabold tracking-tight">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  );
}
