// ============================================================
// BUDGETO v3 — Laporan
// Tren 6 periode (ikut aturan periode), komposisi kategori,
// aktivitas harian. Satu kalimat insight di atas tiap grafik,
// dihitung dari data (bukan ditulis tangan) — design.md §3.
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { db } from "@/lib/db";
import { activeTxs, inPeriod, spentByCategory, topCategoryName } from "@/lib/money";
import { currentPeriod, shiftPeriod, periodLabel } from "@/lib/period";
import { useSettings } from "@/lib/settings";
import { useLang } from "@/lib/i18n";
import { formatMoney, addDays } from "@/lib/format";
import { Card, Segmented, EmptyState } from "./ui-bits";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportsView() {
  const lang = useLang((s) => s.lang);
  const periodMode = useSettings((s) => s.periodMode);
  const payday = useSettings((s) => s.payday);
  const [offset, setOffset] = useState(0);

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);

  const cur = useMemo(() => shiftPeriod(currentPeriod(periodMode, payday), offset, periodMode, payday), [periodMode, payday, offset]);
  const prev = useMemo(() => shiftPeriod(cur, -1, periodMode, payday), [cur, periodMode, payday]);

  const loading = txs === undefined;
  const data = useMemo(() => activeTxs(txs ?? []), [txs]);

  // ── agregat periode aktif & sebelumnya ──
  const curSum = useMemo(() => sumPeriod(data, cur), [data, cur]);
  const prevSum = useMemo(() => sumPeriod(data, prev), [data, prev]);

  // ── tren 6 periode ──
  const trend = useMemo(() => {
    const arr: { label: string; income: number; expense: number }[] = [];
    for (let i = -5; i <= 0; i++) {
      const p = shiftPeriod(cur, i, periodMode, payday);
      const s = sumPeriod(data, p);
      const label = periodLabel(p, lang).split("–")[0]?.trim() ?? "";
      arr.push({ label: label.replace(/^(\d+)\s.*$/, "$1") + " " + p.start.split("-")[1], income: s.income, expense: s.expense });
    }
    return arr;
  }, [data, cur, periodMode, payday, lang]);

  // ── komposisi kategori ──
  const catData = useMemo(() => {
    const map = spentByCategory(data, cur);
    return Array.from(map.entries())
      .map(([id, value]) => ({ name: cats?.find((c) => c.id === id)?.name ?? "—", value, color: cats?.find((c) => c.id === id)?.color ?? "#64748b" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data, cur, cats]);

  // ── aktivitas harian ──
  const dailyData = useMemo(() => {
    const arr: { day: string; expense: number; income: number }[] = [];
    let d = cur.start;
    let guard = 0;
    while (d <= cur.end && guard < 40) {
      const list = data.filter((t) => t.date === d);
      arr.push({
        day: d.split("-")[2],
        expense: list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        income: list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      });
      d = addDays(d, 1);
      guard++;
    }
    return arr;
  }, [data, cur]);

  if (loading) {
    return <div className="space-y-3"><div className="h-32 animate-pulse rounded-2xl bg-surface2" /><div className="h-64 animate-pulse rounded-2xl bg-surface2" /></div>;
  }

  const fmt = (v: number) => formatMoney(v, lang, { compact: true });
  const hasData = data.length > 0;

  // ── insight (dihitung dari data) ──
  const expenseDelta = prevSum.expense > 0 ? ((curSum.expense - prevSum.expense) / prevSum.expense) * 100 : 0;
  const top = topCategoryName(spentByCategory(data, cur), cats ?? []);
  const insightExpense = prevSum.expense > 0
    ? lang === "id"
      ? `Pengeluaran ${expenseDelta >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(expenseDelta))}% dari periode lalu`
      : `Expenses are ${Math.abs(Math.round(expenseDelta))}% ${expenseDelta >= 0 ? "up" : "down"} from last period`
    : null;
  const net = curSum.income - curSum.expense;

  return (
    <div className="space-y-4 pb-2">
      {/* Header + navigasi periode */}
      <div>
        <h1 className="text-lg font-extrabold tracking-tight">{lang === "id" ? "Laporan" : "Reports"}</h1>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} className="rounded-xl bg-card px-3 py-2 text-xs font-bold ring-1 ring-border">←</button>
          <div className="flex-1 text-center">
            <p className="text-xs font-bold">{periodLabel(cur, lang)}</p>
            <p className="text-[10px] text-muted-foreground">{offset === 0 ? (lang === "id" ? "periode ini" : "this period") : ""}</p>
          </div>
          <button onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} className="rounded-xl bg-card px-3 py-2 text-xs font-bold ring-1 ring-border disabled:opacity-30">→</button>
        </div>
      </div>

      {/* Ringkasan periode + net */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Masuk" : "In"}</p>
            <p className="big-number text-[15px] font-extrabold text-income">{fmt(curSum.income)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Keluar" : "Out"}</p>
            <p className="big-number text-[15px] font-extrabold text-expense">{fmt(curSum.expense)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Selisih" : "Net"}</p>
            <p className={cn("big-number text-[15px] font-extrabold", net >= 0 ? "text-ok" : "text-bad")}>{fmt(net)}</p>
          </div>
        </div>
      </Card>

      {!hasData && <EmptyState title={lang === "id" ? "Belum ada data untuk ditampilkan" : "No data to show yet"} />}

      {/* Insight pengeluaran */}
      {insightExpense && (
        <Card className="flex items-start gap-2 p-3.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><Info size={13} /></span>
          <p className="text-xs font-semibold leading-relaxed">{insightExpense}{top ? ` · ${lang === "id" ? "terbesar" : "top"}: ${top.name}` : ""}</p>
        </Card>
      )}

      {/* Tren 6 periode */}
      <ChartCard title={lang === "id" ? "Tren 6 periode" : "6-period trend"}>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={trend} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={fmt} width={58} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k: string) => [fmt(v), k === "income" ? (lang === "id" ? "Masuk" : "In") : (lang === "id" ? "Keluar" : "Out")]} />
            <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => (v === "income" ? (lang === "id" ? "Masuk" : "In") : (lang === "id" ? "Keluar" : "Out"))} />
            <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2.2} dot={{ r: 2.5 }} />
            <Line type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2.2} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Komposisi kategori */}
      {catData.length > 0 && (
        <ChartCard title={lang === "id" ? "Komposisi kategori" : "Category breakdown"}>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                {catData.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {catData.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.name}</span>
                <span className="font-bold">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Aktivitas harian */}
      {dailyData.some((d) => d.expense > 0 || d.income > 0) && (
        <ChartCard title={lang === "id" ? "Aktivitas harian" : "Daily activity"}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <XAxis dataKey="day" tick={{ fontSize: 8, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={fmt} width={58} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, k: string) => [fmt(v), k === "expense" ? (lang === "id" ? "Keluar" : "Out") : (lang === "id" ? "Masuk" : "In")]} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="expense" fill="var(--expense)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="income" fill="var(--income)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border-t)",
  borderRadius: 12,
  fontSize: 11,
  color: "var(--text)",
};

/** Agregat pemasukan/pengeluaran dalam satu periode (murni). */
function sumPeriod(data: import("@/lib/types").Transaction[], p: import("@/lib/types").Period): { income: number; expense: number } {
  let income = 0, expense = 0;
  for (const t of data) {
    if (!inPeriod(t.date, p)) continue;
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  return { income, expense };
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="pb-2 text-xs font-bold">{title}</p>
      {children}
    </Card>
  );
}
