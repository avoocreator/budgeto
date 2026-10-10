// ============================================================
// BUDGETO v3 — Daftar transaksi (F08)
// Dikelompokkan per hari, pencarian real-time (catatan/kategori/dompet),
// filter (jenis, kategori, dompet, rentang tanggal, rentang nominal),
// total hasil. Geser ke kiri untuk hapus → snackbar undo (soft delete,
// restore dengan id yang sama).
// ============================================================

"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { deleteTransaction, restoreTransaction } from "@/lib/repo";
import { useLang } from "@/lib/i18n";
import { formatDateLabel, formatMoney, diffDays } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, EmptyState, IconBubble } from "./ui-bits";
import { TxRow } from "./dashboard-view";
import { Search, SlidersHorizontal, X, Trash2 } from "lucide-react";

interface Filters {
  type: "all" | "income" | "expense" | "transfer";
  categoryId: string;
  walletId: string;
  from: string;
  to: string;
  min: string;
  max: string;
}

const EMPTY: Filters = { type: "all", categoryId: "", walletId: "", from: "", to: "", min: "", max: "" };

export function TransactionsView({ onEditTx }: { onEditTx: (tx: Transaction) => void }) {
  const lang = useLang((s) => s.lang);
  const [q, setQ] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [f, setF] = useState<Filters>(EMPTY);

  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);

  const filtered = useMemo(() => {
    let list = (txs ?? []).filter((t) => !t.deleted);
    const ql = q.trim().toLowerCase();
    if (ql) {
      list = list.filter((t) => {
        const cat = cats?.find((c) => c.id === t.categoryId)?.name?.toLowerCase() ?? "";
        const wal = wallets?.find((w) => w.id === t.walletId || w.id === t.toWalletId)?.name?.toLowerCase() ?? "";
        return t.note.toLowerCase().includes(ql) || cat.includes(ql) || wal.includes(ql);
      });
    }
    if (f.type !== "all") list = list.filter((t) => t.type === f.type);
    if (f.categoryId) list = list.filter((t) => t.categoryId === f.categoryId);
    if (f.walletId) list = list.filter((t) => t.walletId === f.walletId || t.toWalletId === f.walletId);
    if (f.from) list = list.filter((t) => t.date >= f.from);
    if (f.to) list = list.filter((t) => t.date <= f.to);
    if (f.min) list = list.filter((t) => t.amount >= Number(f.min));
    if (f.max) list = list.filter((t) => t.amount <= Number(f.max));
    return list.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  }, [txs, q, f, cats, wallets]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totals = useMemo(() => {
    let inSum = 0, outSum = 0;
    for (const t of filtered) {
      if (t.type === "income") inSum += t.amount;
      else if (t.type === "expense") outSum += t.amount;
    }
    return { inSum, outSum };
  }, [filtered]);

  const handleDelete = (t: Transaction) => {
    const snapshot = t;
    void deleteTransaction(t.id);
    toast(lang === "id" ? "Dibatalkan?" : "Undo delete?", {
      description: lang === "id" ? "Transaksi dihapus" : "Transaction deleted",
      duration: 6000,
      action: {
        label: lang === "id" ? "Batalkan" : "Undo",
        onClick: () => void restoreTransaction(snapshot),
      },
    });
  };

  const activeFilterCount = Object.entries(f).filter(([, v]) => v && v !== "all").length;

  return (
    <div className="space-y-3 pb-2">
      {/* Pencarian + tombol filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lang === "id" ? "Cari catatan, kategori, dompet…" : "Search notes, categories, wallets…"}
            className="h-10 w-full rounded-xl bg-card pl-9 pr-8 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Bersihkan" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilter((v) => !v)}
          aria-expanded={showFilter}
          className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-border transition-colors",
            showFilter || activeFilterCount > 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
        >
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-expense text-[9px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Panel filter */}
      {showFilter && (
        <Card className="anim-rise space-y-2.5 p-3.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Jenis" : "Type"}</span>
              <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Filters["type"] })} className="w-full rounded-xl bg-surface2 px-2.5 py-2 text-xs font-semibold outline-none">
                <option value="all">{lang === "id" ? "Semua jenis" : "All types"}</option>
                <option value="income">{lang === "id" ? "Pemasukan" : "Income"}</option>
                <option value="expense">{lang === "id" ? "Pengeluaran" : "Expense"}</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
            <label className="block">
              <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Kategori" : "Category"}</span>
              <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className="w-full rounded-xl bg-surface2 px-2.5 py-2 text-xs font-semibold outline-none">
                <option value="">{lang === "id" ? "Semua kategori" : "All categories"}</option>
                {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Dompet" : "Wallet"}</span>
              <select value={f.walletId} onChange={(e) => setF({ ...f, walletId: e.target.value })} className="w-full rounded-xl bg-surface2 px-2.5 py-2 text-xs font-semibold outline-none">
                <option value="">{lang === "id" ? "Semua dompet" : "All wallets"}</option>
                {(wallets ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Dari" : "From"}</span>
                <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-full rounded-xl bg-surface2 px-2 py-2 text-xs outline-none" />
              </label>
              <label className="block">
                <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Sampai" : "To"}</span>
                <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-full rounded-xl bg-surface2 px-2 py-2 text-xs outline-none" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Nominal min" : "Min amount"}</span>
              <input inputMode="numeric" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/\D/g, "") })} placeholder="0" className="w-full rounded-xl bg-surface2 px-2.5 py-2 text-xs outline-none" />
            </label>
            <label className="block">
              <span className="pb-1 text-[10px] font-bold text-muted-foreground uppercase">{lang === "id" ? "Nominal maks" : "Max amount"}</span>
              <input inputMode="numeric" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value.replace(/\D/g, "") })} placeholder="∞" className="w-full rounded-xl bg-surface2 px-2.5 py-2 text-xs outline-none" />
            </label>
          </div>
          <div className="flex gap-2 pt-0.5">
            <button onClick={() => setF(EMPTY)} className="flex-1 rounded-xl bg-surface2 py-2 text-xs font-bold text-muted-foreground">
              {lang === "id" ? "Reset" : "Reset"}
            </button>
            <button onClick={() => setShowFilter(false)} className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground">
              {lang === "id" ? "Terapkan" : "Apply"}
            </button>
          </div>
        </Card>
      )}

      {/* Ringkasan hasil */}
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{filtered.length} {lang === "id" ? "hasil" : "results"}</span>
        <span className="flex gap-2.5">
          <span className="font-bold text-income">+{formatMoney(totals.inSum, lang, { compact: true })}</span>
          <span className="font-bold text-expense">−{formatMoney(totals.outSum, lang, { compact: true })}</span>
        </span>
      </div>

      {/* Daftar per hari */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title={q || activeFilterCount ? (lang === "id" ? "Tidak ada transaksi yang cocok" : "No matching transactions") : (lang === "id" ? "Belum ada transaksi" : "No transactions yet")}
          desc={q || activeFilterCount ? undefined : (lang === "id" ? "Tekan tombol + untuk mencatat yang pertama" : "Tap + to record your first one")}
        />
      ) : (
        grouped.map(([date, list]) => {
          const dayIn = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
          const dayOut = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          return (
            <section key={date}>
              <div className="flex items-center justify-between px-1 pb-1.5">
                <p className="text-[11px] font-bold text-muted-foreground">
                  {formatDateLabel(date, lang)} · {lang === "id" ? hariName(date) : hariName(date)}
                </p>
                <p className="flex gap-2 text-[10px] font-semibold">
                  {dayIn > 0 && <span className="text-income">+{formatMoney(dayIn, lang, { compact: true })}</span>}
                  {dayOut > 0 && <span className="text-expense">−{formatMoney(dayOut, lang, { compact: true })}</span>}
                </p>
              </div>
              <div className="space-y-1.5">
                {list.map((t) => (
                  <SwipeRow key={t.id} tx={t} cats={cats ?? []} onEdit={() => onEditTx(t)} onDelete={() => handleDelete(t)} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function hariName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(new Date(y, m - 1, d));
}

/** Baris dengan geser kiri untuk hapus (F08); tap = edit.
 *  Edit dikenali dari pointerup (bukan click) agar swipe tidak pernah
 *  memicu sheet edit secara tidak sengaja. */
function SwipeRow({ tx, cats, onEdit, onDelete }: { tx: Transaction; cats: import("@/lib/types").Category[]; onEdit: () => void; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  const onDown = (e: React.TouchEvent | React.PointerEvent) => {
    startX.current = "touches" in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    startY.current = "touches" in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    dragging.current = true;
    moved.current = false;
  };
  const onMove = (e: React.TouchEvent | React.PointerEvent) => {
    if (!dragging.current) return;
    const x = "touches" in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const y = "touches" in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    if (Math.abs(x - startX.current) > 6 || Math.abs(y - startY.current) > 6) moved.current = true;
    setDx(Math.min(0, x - startX.current));
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dx < -72) {
      setDx(0);
      onDelete();
      return;
    }
    if (dx !== 0) setDx(0);
    if (!moved.current) onEdit(); // tap singkat = buka edit
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center rounded-2xl bg-bad text-white" aria-hidden>
        <Trash2 size={18} />
      </div>
      <div
        className="relative touch-pan-y transition-transform duration-150"
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <TxRow tx={tx} cats={cats} />
      </div>
    </div>
  );
}
