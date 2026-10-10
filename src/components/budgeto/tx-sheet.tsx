// ============================================================
// BUDGETO v3 — Alur catat cepat (F02)
// Bottom sheet: nominal dulu (papan angka besar), kategori disarankan
// sudah terpilih (chip paling kiri), lalu simpan → maksimal 3 ketukan.
// Baris opsional (catatan, dompet, tanggal) tersembunyi sampai dibuka.
// Guard simpan ganda ada di repo.saveTransaction.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { saveTransaction, suggestCategories } from "@/lib/repo";
import { useSettings } from "@/lib/settings";
import { useLang } from "@/lib/i18n";
import { todayStr, addDays } from "@/lib/format";
import { PALETTE } from "@/lib/types";
import type { Transaction, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import { IconBubble } from "./ui-bits";
import { ChevronDown, ArrowRightLeft, Check, Vibrate } from "lucide-react";

export interface TxSheetState {
  open: boolean;
  prefillType?: TxType;
  edit?: Transaction | null;
}

const NUMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"];

export function TransactionSheet({ state, onClose }: { state: TxSheetState; onClose: () => void }) {
  const lang = useLang((s) => s.lang);
  const lastWalletId = useSettings((s) => s.lastWalletId);

  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);

  const [type, setType] = useState<TxType>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [openRows, setOpenRows] = useState<{ note: boolean; wallet: boolean; date: boolean }>({ note: false, wallet: false, date: false });
  const [suggestions, setSuggestions] = useState<{ ranked: { id: string; name: string; icon: string; color: string }[]; top: { id: string; name: string; icon: string; color: string } | null }>({ ranked: [], top: null });
  const [saving, setSaving] = useState(false);

  const isEdit = !!state.edit;

  // Reset saat sheet dibuka / jenis berubah
  useEffect(() => {
    if (!state.open) return;
    const t = state.edit ? state.edit.type : state.prefillType ?? "expense";
    setType(t);
    setAmountStr(state.edit ? String(state.edit.amount) : "");
    setNote(state.edit?.note ?? "");
    setDate(state.edit?.date ?? todayStr());
    setOpenRows({ note: false, wallet: false, date: false });
    if (state.edit) {
      setCategoryId(state.edit.categoryId);
      setWalletId(state.edit.walletId);
      setToWalletId(state.edit.toWalletId ?? "");
    } else {
      setCategoryId(null);
      setWalletId(lastWalletId || wallets?.[0]?.id || "");
      setToWalletId("");
    }
  }, [state.open, state.prefillType, state.edit, lastWalletId, wallets]);

  // Saran kategori (F02) — teratas terpilih otomatis
  useEffect(() => {
    if (!state.open || type === "transfer") return;
    void suggestCategories(type as "income" | "expense", note).then(({ ranked, top }) => {
      setSuggestions({ ranked: ranked.slice(0, 8), top });
      setCategoryId((cur) => {
        if (isEdit && cur) return cur;
        return top?.id ?? ranked[0]?.id ?? cur;
      });
    });
  }, [state.open, type, note, isEdit]);

  const amount = useMemo(() => {
    const n = Number(amountStr.replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  const press = useCallback((k: string) => {
    setAmountStr((s) => {
      if (k === "⌫") return s.slice(0, -1);
      const next = (s + k).replace(/^0+(?=\d)/, "");
      return next.slice(0, 12);
    });
  }, []);

  const canSave = amount > 0 && (type === "transfer" ? walletId && toWalletId && walletId !== toWalletId : !!walletId && !!categoryId);

  const doSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await saveTransaction({
        id: state.edit?.id,
        type,
        amount,
        categoryId,
        walletId,
        toWalletId,
        date,
        note,
      });
      // getar ringan saat tersimpan (design.md §5)
      navigator.vibrate?.(18);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, state.edit, type, amount, categoryId, walletId, toWalletId, date, note, onClose]);

  if (!state.open) return null;

  const typeTabs: { value: TxType; label: string }[] = [
    { value: "expense", label: lang === "id" ? "Pengeluaran" : "Expense" },
    { value: "income", label: lang === "id" ? "Pemasukan" : "Income" },
    { value: "transfer", label: lang === "id" ? "Transfer" : "Transfer" },
  ];
  const shownCats = (cats ?? []).filter((c) => (type === "income" || type === "expense") && c.type === type);
  const rankedList = type === "transfer" ? [] : suggestions.ranked.length > 0
    ? suggestions.ranked
    : shownCats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Catat transaksi">
      <button aria-label="Tutup" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-sheet relative mx-auto w-full max-w-md rounded-t-[28px] border bg-card pb-[calc(env(safe-area-inset-bottom,0px)+12px)] shadow-2xl">
        {/* Pegangan + jenis */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        <div className="flex gap-1.5 px-4 pt-3">
          {typeTabs.map((t) => (
            <button
              key={t.value}
              onClick={() => { setType(t.value); if (t.value !== "transfer") setCategoryId(null); }}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-bold transition-all",
                type === t.value
                  ? t.value === "income" ? "bg-income/15 text-income ring-1 ring-income/30" : t.value === "expense" ? "bg-expense/15 text-expense ring-1 ring-expense/30" : "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-surface2 text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Nominal besar */}
        <div className="px-4 pt-3 text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-lg font-semibold text-muted-foreground">Rp</span>
            <span key={amountStr} className="popnum big-number text-[40px] font-extrabold leading-tight" style={{ color: amount > 0 ? undefined : "var(--text-muted)" }}>
              {amountStr === "" ? "0" : new Intl.NumberFormat("id-ID").format(amount)}
            </span>
          </div>
        </div>

        <div className="max-h-[42dvh] overflow-y-auto thin-scroll px-4 pt-2">
          {/* Kategori — chip satu ketukan; saran paling kiri & terpilih */}
          {type !== "transfer" && (
            <div>
              <p className="pb-1.5 text-[11px] font-semibold text-muted-foreground">{lang === "id" ? "Kategori" : "Category"}</p>
              <div className="flex gap-1.5 overflow-x-auto thin-scroll pb-1">
                {rankedList.map((c) => {
                  const selected = categoryId === c.id;
                  const isTop = suggestions.top?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      aria-pressed={selected}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold transition-all",
                        selected ? "text-white shadow-sm" : "bg-surface2 text-foreground/80 hover:bg-border/60"
                      )}
                      style={selected ? { backgroundColor: c.color } : undefined}
                    >
                      <IconBubble name={c.icon} color={selected ? "#ffffff" : c.color} size={22} />
                      {c.name}
                      {isTop && !selected && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">★</span>}
                    </button>
                  );
                })}
                {rankedList.length === 0 && <span className="py-2 text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          )}

          {/* Transfer: pilih dua dompet */}
          {type === "transfer" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <WalletSelect label={lang === "id" ? "Dari dompet" : "From wallet"} wallets={wallets ?? []} value={walletId} onChange={setWalletId} />
              <WalletSelect label={lang === "id" ? "Ke dompet" : "To wallet"} wallets={wallets ?? []} value={toWalletId} onChange={setToWalletId} />
            </div>
          )}

          {/* Baris opsional */}
          <div className="mt-2.5 space-y-1.5">
            {type !== "transfer" && (
              <OptionalRow
                label={lang === "id" ? "Dompet" : "Wallet"}
                value={wallets?.find((w) => w.id === walletId)?.name ?? ""}
                icon="wallet"
                open={openRows.wallet}
                onToggle={() => setOpenRows((r) => ({ ...r, wallet: !r.wallet }))}
              >
                <div className="flex flex-wrap gap-1.5 py-1">
                  {(wallets ?? []).map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setWalletId(w.id)}
                      className={cn("flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold", walletId === w.id ? "text-white" : "bg-surface2 text-foreground/80")}
                      style={walletId === w.id ? { backgroundColor: w.color } : undefined}
                    >
                      <IconBubble name={w.icon} color={walletId === w.id ? "#ffffff" : w.color} size={20} />
                      {w.name}
                    </button>
                  ))}
                </div>
              </OptionalRow>
            )}
            <OptionalRow
              label={lang === "id" ? "Catatan" : "Note"}
              value={note}
              icon="pencil-line"
              open={openRows.note}
              onToggle={() => setOpenRows((r) => ({ ...r, note: !r.note }))}
            >
              <input
                autoFocus={openRows.note}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={lang === "id" ? "mis. bakso siang" : "e.g. lunch meatballs"}
                className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
              />
            </OptionalRow>
            <OptionalRow
              label={lang === "id" ? "Tanggal" : "Date"}
              value={dateLabel(date, lang)}
              icon="calendar"
              open={openRows.date}
              onToggle={() => setOpenRows((r) => ({ ...r, date: !r.date }))}
            >
              <div className="flex gap-1.5 py-1">
                {[
                  { v: todayStr(), l: lang === "id" ? "Hari ini" : "Today" },
                  { v: addDays(todayStr(), -1), l: lang === "id" ? "Kemarin" : "Yesterday" },
                ].map((o) => (
                  <button key={o.v} onClick={() => setDate(o.v)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", date === o.v ? "bg-primary text-primary-foreground" : "bg-surface2 text-muted-foreground")}>
                    {o.l}
                  </button>
                ))}
                <input
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={(e) => setDate(e.target.value || todayStr())}
                  className="rounded-xl bg-surface2 px-3 py-1.5 text-xs outline-none ring-1 ring-border"
                />
              </div>
            </OptionalRow>
          </div>
        </div>

        {/* Papan angka */}
        <div className="grid grid-cols-3 gap-1.5 px-4 pt-2.5">
          {NUMS.map((n) => (
            <button
              key={n}
              onClick={() => press(n)}
              className="h-11 rounded-xl bg-surface2 text-lg font-bold text-foreground transition-transform active:scale-95 active:bg-border/70"
              aria-label={n === "⌫" ? "Hapus angka" : n}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Simpan — lebar penuh */}
        <div className="px-4 pt-2.5">
          <button
            onClick={() => void doSave()}
            disabled={!canSave || saving}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-extrabold transition-all active:scale-[0.98]",
              canSave ? "bg-primary text-primary-foreground shadow-md" : "cursor-not-allowed bg-surface2 text-muted-foreground"
            )}
          >
            <Check size={17} strokeWidth={2.6} />
            {saving ? (lang === "id" ? "Menyimpan…" : "Saving…") : lang === "id" ? "Simpan" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function dateLabel(d: string, lang: "id" | "en"): string {
  const today = todayStr();
  if (d === today) return lang === "id" ? "Hari ini" : "Today";
  if (d === addDays(today, -1)) return lang === "id" ? "Kemarin" : "Yesterday";
  return d;
}

function OptionalRow({ label, value, icon, open, onToggle, children }: {
  label: string; value: string; icon: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface2/60 ring-1 ring-border/50">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open}>
        <Icon name={icon} size={15} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-foreground/80">
          {value || <em className="not-italic opacity-50">•</em>}
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="px-3 pb-2.5">{children}</div>}
    </div>
  );
}

function WalletSelect({ label, wallets, value, onChange }: { label: string; wallets: Wallet[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="pb-1 text-[11px] font-semibold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
      >
        {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  );
}

interface Wallet { id: string; name: string; icon: string; color: string }
