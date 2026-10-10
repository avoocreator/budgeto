// ============================================================
// BUDGETO v2 — Sheet tambah/edit transaksi (bottom sheet native feel)
// ============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Check, Trash2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { saveTransaction, deleteTransaction } from "@/lib/repo";
import { useSettings } from "@/lib/settings";
import { currencySymbol, todayStr } from "@/lib/format";
import type { Transaction, TxType } from "@/lib/types";
import { CatIcon } from "./ui-bits";
import { toast } from "sonner";

export interface TxSheetState {
  open: boolean;
  edit?: Transaction; // transaksi yang diedit (dikirim langsung, tanpa fetch ulang)
  prefillType?: TxType;
}

export function TransactionSheet({ state, onClose, onSaved }: {
  state: TxSheetState;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const currency = useSettings((s) => s.currency);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const editing = state.edit;

  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill saat buka — sumber data langsung dari props (sinkron, tanpa race)
  useEffect(() => {
    if (!state.open) return;
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setCategoryId(editing.categoryId);
      setWalletId(editing.walletId);
      setToWalletId(editing.toWalletId ?? null);
      setDate(editing.date);
      setNote(editing.note);
    } else {
      setType(state.prefillType ?? "expense");
      setAmount("");
      setCategoryId(null);
      setToWalletId(null);
      setDate(todayStr());
      setNote("");
      setWalletId((prev) => prev ?? wallets?.[0]?.id ?? null);
    }
  }, [state.open, editing?.id]);

  useEffect(() => {
    if (walletId) return;
    if (wallets && wallets.length > 0) setWalletId(wallets[0].id);
  }, [wallets, walletId]);

  const filteredCats = useMemo(
    () => (categories ?? []).filter((c) => type !== "transfer" && c.type === type),
    [categories, type]
  );

  // Auto pilih kategori pertama bila ganti tipe
  useEffect(() => {
    if (type === "transfer") { setCategoryId(null); return; }
    if (categoryId && filteredCats.some((c) => c.id === categoryId)) return;
    setCategoryId(filteredCats[0]?.id ?? null);
  }, [type, filteredCats.length]);

  const numericAmount = Number(amount.replace(/[^\d]/g, "")) || 0;
  const accent = type === "income" ? "var(--income)" : type === "expense" ? "var(--expense)" : "var(--primary)";

  async function handleSave() {
    if (numericAmount <= 0) { toast.error("Masukkan jumlahnya dulu ya"); return; }
    if (!walletId) { toast.error("Pilih dompet dulu"); return; }
    if (type === "transfer" && (!toWalletId || toWalletId === walletId)) {
      toast.error("Pilih dua dompet yang berbeda untuk transfer");
      return;
    }
    setSaving(true);
    try {
      await saveTransaction({
        id: editing?.id,
        type, amount: numericAmount, categoryId,
        walletId, toWalletId, date, note,
      });
      toast.success(editing ? "Transaksi diperbarui" : "Transaksi dicatat", {
        description: `${type === "income" ? "+" : type === "expense" ? "-" : ""}${currencySymbol(currency)}${numericAmount.toLocaleString("id-ID")}`,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing?.id) return;
    await deleteTransaction(editing.id);
    toast.success("Transaksi dihapus");
    onClose();
  }

  const typeBtn = (t: TxType, label: string, Icon: typeof ArrowDownCircle) => {
    const active = type === t;
    const tint = t === "income" ? "var(--income)" : t === "expense" ? "var(--expense)" : "var(--primary)";
    return (
      <button
        type="button"
        onClick={() => setType(t)}
        className={cn(
          "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold transition-all duration-200",
          active ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        style={active ? { backgroundColor: `${tint}1f`, color: tint, boxShadow: `inset 0 0 0 1.5px ${tint}45` } : undefined}
        aria-pressed={active}
      >
        <Icon size={15} />
        {label}
      </button>
    );
  };

  return (
    <Drawer open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerTitle className="sr-only">{editing ? "Edit transaksi" : "Tambah transaksi"}</DrawerTitle>
        <div className="mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-1">
          {/* Toggle jenis — segmen menyatu */}
          <div className="flex rounded-2xl bg-muted p-1">
            {typeBtn("expense", "Keluar", ArrowDownCircle)}
            {typeBtn("income", "Masuk", ArrowUpCircle)}
            {typeBtn("transfer", "Transfer", ArrowLeftRight)}
          </div>

          {/* Jumlah */}
          <div className="flex items-center justify-center gap-1.5 py-4">
            <span className="text-[26px] font-bold" style={{ color: numericAmount > 0 ? accent : "var(--muted-foreground)" }}>
              {currencySymbol(currency)}
            </span>
            <input
              inputMode="numeric"
              autoFocus
              placeholder="0"
              value={amount === "" ? "" : Number(amount.replace(/[^\d]/g, "")).toLocaleString("id-ID")}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="tnum w-full min-w-0 bg-transparent text-center text-[42px] font-extrabold leading-none tracking-tight outline-none placeholder:text-muted-foreground/25"
              style={{ color: numericAmount > 0 ? accent : undefined }}
              aria-label="Jumlah"
            />
          </div>

          {/* Kategori */}
          {type !== "transfer" && (
            <div className="thin-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5">
              {filteredCats.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-all duration-150 active:scale-95",
                      active ? "font-bold" : "border-border bg-card text-muted-foreground hover:bg-muted"
                    )}
                    style={active ? { borderColor: `${c.color}70`, backgroundColor: `${c.color}1c`, color: c.color } : undefined}
                  >
                    <CatIcon name={c.icon} color={c.color} size={13} />
                    {c.name}
                  </button>
                );
              })}
              {filteredCats.length === 0 && (
                <p className="py-1.5 text-xs text-muted-foreground">Belum ada kategori — tambahkan di Menu → Kategori</p>
              )}
            </div>
          )}

          {/* Dompet */}
          <div className="mt-2.5 flex gap-2">
            <select
              value={walletId ?? ""}
              onChange={(e) => setWalletId(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-[13px] font-medium shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
              aria-label="Dari dompet"
            >
              <option value="" disabled>{type === "transfer" ? "Dari dompet" : "Dompet"}</option>
              {(wallets ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {type === "transfer" && (
              <select
                value={toWalletId ?? ""}
                onChange={(e) => setToWalletId(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-3 text-[13px] font-medium shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
                aria-label="Ke dompet"
              >
                <option value="" disabled>Ke dompet</option>
                {(wallets ?? []).filter((w) => w.id !== walletId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>

          {/* Tanggal + catatan */}
          <div className="mt-2 flex gap-2">
            <div className="relative">
              <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl border bg-card pl-8 pr-2 text-[13px] font-medium shadow-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
                aria-label="Tanggal"
              />
            </div>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className="h-10 flex-1 rounded-xl bg-card text-[13px] shadow-sm"
              maxLength={80}
            />
          </div>

          {/* Aksi */}
          <div className="mt-4 flex gap-2">
            {editing && (
              <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl border-expense/30 text-expense hover:bg-expense/10" onClick={handleDelete} aria-label="Hapus transaksi">
                <Trash2 size={17} />
              </Button>
            )}
            <Button
              className="h-12 flex-1 rounded-xl text-[15px] font-bold shadow-lg shadow-emerald-600/25 transition-transform active:scale-[0.98]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Simpan Transaksi"}
              {!saving && <Check size={16} className="ml-1" />}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
