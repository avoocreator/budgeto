// ============================================================
// BUDGETO v2 — Daftar Transaksi (filter, cari, hapus)
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { formatDateLabel, monthLabel, monthStr, formatMoney } from "@/lib/format";
import { Card, EmptyState, SectionTitle } from "./ui-bits";
import { TxRow } from "./dashboard-view";
import { Input } from "@/components/ui/input";
import { Search, ListFilter, ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export function TransactionsView({ onEditTx }: { onEditTx: (tx: import("@/lib/types").Transaction) => void }) {
  const { currency } = useSettings();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [monthFilter, setMonthFilter] = useState<string>(monthStr(0)); // "" = semua

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);

  const availableMonths = useMemo(() => {
    const set = new Set((txs ?? []).filter((t) => !t.deleted).map((t) => t.date.slice(0, 7)));
    set.add(monthStr(0));
    return [...set].sort().reverse().slice(0, 24);
  }, [txs]);

  const filtered = useMemo(() => {
    let list = (txs ?? []).filter((t) => !t.deleted);
    if (monthFilter) list = list.filter((t) => t.date.startsWith(monthFilter));
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = t.categoryId ? categories?.find((c) => c.id === t.categoryId)?.name ?? "" : "";
        return t.note.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || String(t.amount).includes(q);
      });
    }
    return list.sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1));
  }, [txs, categories, search, typeFilter, monthFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  const dayNet = (list: typeof filtered) =>
    list.reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0);

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-all duration-150 active:scale-95",
      active
        ? "border-primary bg-gradient-to-r from-emerald-600 to-teal-500 font-bold text-white shadow-sm shadow-emerald-600/25"
        : "border-border bg-card text-muted-foreground hover:bg-muted"
    );

  return (
    <div className="space-y-3">
      {/* Pencarian */}
      <div className="anim-rise relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari catatan, kategori, jumlah..." className="h-10 rounded-2xl border bg-card pl-9.5 text-sm shadow-sm" />
      </div>

      {/* Filter bulan */}
      <div className="thin-scroll anim-rise d1 flex gap-2 overflow-x-auto pb-1">
        <button className={chip(monthFilter === "")} onClick={() => setMonthFilter("")}>Semua</button>
        {availableMonths.map((m) => (
          <button key={m} className={chip(monthFilter === m)} onClick={() => setMonthFilter(m)}>{monthLabel(m)}</button>
        ))}
      </div>

      {/* Filter jenis */}
      <div className="thin-scroll anim-rise d2 flex gap-2 overflow-x-auto pb-1">
        <button className={chip(typeFilter === "all")} onClick={() => setTypeFilter("all")}>Semua jenis</button>
        <button className={chip(typeFilter === "expense")} onClick={() => setTypeFilter("expense")}>Pengeluaran</button>
        <button className={chip(typeFilter === "income")} onClick={() => setTypeFilter("income")}>Pemasukan</button>
        <button className={chip(typeFilter === "transfer")} onClick={() => setTypeFilter("transfer")}>Transfer</button>
      </div>

      {/* Ringkasan hasil filter */}
      {filtered.length > 0 && (
        <Card className="anim-rise d3 grid grid-cols-3 divide-x divide-border/70 py-2.5 overflow-hidden">
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"><ArrowUpRight size={10} className="text-income" /> Masuk</p>
            <p className="tnum mt-0.5 text-[13px] font-bold text-income">{formatMoney(totals.income, currency, { compact: true })}</p>
          </div>
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"><ArrowDownLeft size={10} className="text-expense" /> Keluar</p>
            <p className="tnum mt-0.5 text-[13px] font-bold text-expense">{formatMoney(totals.expense, currency, { compact: true })}</p>
          </div>
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"><Scale size={10} /> Selisih</p>
            <p className={cn("tnum mt-0.5 text-[13px] font-bold", totals.net >= 0 ? "text-income" : "text-expense")}>{formatMoney(totals.net, currency, { compact: true })}</p>
          </div>
        </Card>
      )}

      {/* Daftar */}
      {grouped.length === 0 ? (
        <EmptyState icon={ListFilter} title="Tidak ada transaksi" subtitle="Coba ubah filter atau catat transaksi baru" />
      ) : (
        grouped.map(([date, list]) => {
          const net = dayNet(list);
          return (
            <section key={date}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{formatDateLabel(date)}</h2>
                <span className={cn("tnum text-[11px] font-bold", net >= 0 ? "text-income" : "text-expense")}>
                  {net >= 0 ? "+" : "−"}{formatMoney(Math.abs(net), currency, { compact: true })}
                </span>
              </div>
              <Card className="divide-y divide-border/70 overflow-hidden p-0">
                {list.map((t) => <TxRow key={t.id} tx={t} categories={categories ?? []} currency={currency} onClick={() => onEditTx(t)} />)}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
