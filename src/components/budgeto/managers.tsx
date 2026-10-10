// ============================================================
// BUDGETO v3 — Layar kelola: Budget, Dompet, Target Tabungan, Kategori
// Ditata ulang ke token tema v3 (F03); logika tetap dari repo.ts.
// ============================================================

"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { saveBudget, deleteBudget, saveWallet, deleteWallet, saveGoal, addToGoal, deleteGoal, saveCategory, deleteCategory } from "@/lib/repo";
import { walletBalance } from "@/lib/money";
import { PALETTE } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { currentPeriod } from "@/lib/period";
import { Card, MoneyText, ProgressBar, EmptyState, IconBubble } from "./ui-bits";
import { Icon, ICON_NAMES } from "./icons";
import { ArrowLeft, Plus, Pencil, Trash2, Target as TargetIcon, Wallet2, Tags, Gauge } from "lucide-react";
import { todayStr } from "@/lib/format";

function SubHeader({ title, desc, onBack }: { title: string; desc: string; onBack: () => void }) {
  return (
    <div className="flex items-start gap-2.5 pb-1">
      <button onClick={onBack} aria-label="Kembali" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border">
        <ArrowLeft size={17} />
      </button>
      <div>
        <h1 className="text-lg font-extrabold tracking-tight">{title}</h1>
        <p className="text-[11px] leading-snug text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BUDGET
// ════════════════════════════════════════════════════════════
export function BudgetsView({ onBack }: { onBack: () => void }) {
  const lang = useLang((s) => s.lang);
  const periodMode = useSettings((s) => s.periodMode);
  const payday = useSettings((s) => s.payday);
  const budgets = useLiveQuery(() => db.budgets.filter((b) => !b.deleted).toArray(), []);
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted && c.type === "expense").toArray(), []);

  const [form, setForm] = useState<{ open: boolean; id?: string; categoryId: string; amount: string }>({ open: false, categoryId: "", amount: "" });

  // hitung pakai periode aktif (F05)
  const spentMap = new Map<string, number>();
  const period = currentPeriod(periodMode, payday);
  for (const t of txs ?? []) {
    if (t.deleted || t.type !== "expense" || !t.categoryId) continue;
    if (t.date >= period.start && t.date <= period.end) spentMap.set(t.categoryId, (spentMap.get(t.categoryId) ?? 0) + t.amount);
  }

  const usedCatIds = new Set((budgets ?? []).filter((b) => !b.deleted).map((b) => b.categoryId));
  const availableCats = (cats ?? []).filter((c) => !usedCatIds.has(c.id) || c.id === form.categoryId);

  return (
    <div className="space-y-3">
      <SubHeader title={lang === "id" ? "Budget" : "Budgets"} desc={lang === "id" ? "Batas belanja per kategori, berlaku per periode" : "Per-category spending limits, applied per period"} onBack={onBack} />

      <div className="space-y-2">
        {(budgets ?? []).filter((b) => !b.deleted).map((b) => {
          const cat = cats?.find((c) => c.id === b.categoryId);
          const spent = spentMap.get(b.categoryId) ?? 0;
          const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
          return (
            <Card key={b.id} className="p-4">
              <div className="flex items-center gap-2.5">
                <IconBubble name={cat?.icon ?? "shapes"} color={cat?.color ?? "#64748b"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{cat?.name ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <MoneyText amount={spent} className="font-semibold" /> / <MoneyText amount={b.amount} className="font-semibold" />
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setForm({ open: true, id: b.id, categoryId: b.categoryId, amount: String(b.amount) })} aria-label="Ubah" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm(lang === "id" ? "Hapus budget ini?" : "Delete this budget?")) void deleteBudget(b.id); }} aria-label="Hapus" className="flex h-8 w-8 items-center justify-center rounded-lg text-bad hover:bg-bad/10"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-2.5">
                <ProgressBar percent={pct} />
                <div className="mt-1.5 flex justify-between text-[10px] font-semibold">
                  <span className={pct >= 100 ? "text-bad" : pct >= 80 ? "text-warn" : "text-muted-foreground"}>{Math.round(pct)}%</span>
                  <span className={b.amount - spent < 0 ? "text-bad" : "text-muted-foreground"}>
                    {b.amount - spent >= 0
                      ? `${lang === "id" ? "sisa" : "left"} `
                      : `${lang === "id" ? "lewat" : "over by"} `}
                    <MoneyText amount={Math.abs(b.amount - spent)} className={b.amount - spent < 0 ? "text-bad" : "text-foreground"} />
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {(budgets ?? []).length === 0 && (
        <EmptyState icon={<Gauge size={20} />} title={lang === "id" ? "Belum ada budget" : "No budgets yet"} desc={lang === "id" ? "Atur batas per kategori supaya sisa harian bisa dihitung" : "Set category limits so daily allowance can be computed"} />
      )}

      <button
        onClick={() => setForm({ open: true, categoryId: availableCats[0]?.id ?? "", amount: "" })}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 text-xs font-bold text-primary"
      >
        <Plus size={15} /> {lang === "id" ? "Tambah budget" : "Add budget"}
      </button>

      {/* Form dialog */}
      {form.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button className="absolute inset-0 bg-black/45" onClick={() => setForm({ open: false, categoryId: "", amount: "" })} aria-label="Tutup" />
          <div className="anim-sheet relative mx-auto w-full max-w-md rounded-t-[24px] border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <h3 className="pb-3 text-sm font-extrabold">{form.id ? (lang === "id" ? "Ubah budget" : "Edit budget") : (lang === "id" ? "Tambah budget" : "Add budget")}</h3>
            <label className="block pb-2.5">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Kategori" : "Category"}</span>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} disabled={!!form.id} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-border">
                <option value="">—</option>
                {availableCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block pb-3">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Nominal per periode" : "Amount per period"}</span>
              <input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })} placeholder="0" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-border" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setForm({ open: false, categoryId: "", amount: "" })} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Batal" : "Cancel"}</button>
              <button
                disabled={!form.categoryId || !Number(form.amount)}
                onClick={async () => { await saveBudget({ id: form.id, categoryId: form.categoryId, amount: Number(form.amount) }); setForm({ open: false, categoryId: "", amount: "" }); }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
              >
                {lang === "id" ? "Simpan" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DOMPET
// ════════════════════════════════════════════════════════════
export function WalletsView({ onBack }: { onBack: () => void }) {
  const lang = useLang((s) => s.lang);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const [form, setForm] = useState<{ open: boolean; id?: string; name: string; icon: string; color: string; initialBalance: string }>({ open: false, name: "", icon: "wallet", color: PALETTE[0], initialBalance: "" });

  return (
    <div className="space-y-3">
      <SubHeader title={lang === "id" ? "Dompet" : "Wallets"} desc={lang === "id" ? "Tunai, bank, e-wallet — saldo dihitung dari transaksi" : "Cash, bank, e-wallet — balances computed from transactions"} onBack={onBack} />

      <div className="grid grid-cols-2 gap-2">
        {(wallets ?? []).map((w) => {
          const bal = walletBalance(w.id, txs ?? [], wallets ?? []);
          return (
            <Card key={w.id} className="p-3.5">
              <div className="flex items-start justify-between">
                <IconBubble name={w.icon} color={w.color} size={34} />
                <div className="flex gap-0.5">
                  <button onClick={() => setForm({ open: true, id: w.id, name: w.name, icon: w.icon, color: w.color, initialBalance: String(w.initialBalance) })} aria-label="Ubah" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil size={12} /></button>
                  <button onClick={() => { if (confirm(lang === "id" ? "Arsipkan dompet ini?" : "Archive this wallet?")) void deleteWallet(w.id); }} aria-label="Hapus" className="flex h-7 w-7 items-center justify-center rounded-lg text-bad hover:bg-bad/10"><Trash2 size={12} /></button>
                </div>
              </div>
              <p className="mt-2 truncate text-[12px] font-bold">{w.name}</p>
              <MoneyText amount={bal} className={cn("text-[15px] font-extrabold", bal < 0 && "text-bad")} />
            </Card>
          );
        })}
      </div>

      <button
        onClick={() => setForm({ open: true, name: "", icon: "wallet", color: PALETTE[(wallets?.length ?? 0) % PALETTE.length], initialBalance: "" })}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 text-xs font-bold text-primary"
      >
        <Plus size={15} /> {lang === "id" ? "Tambah dompet" : "Add wallet"}
      </button>

      {form.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button className="absolute inset-0 bg-black/45" onClick={() => setForm({ ...form, open: false })} aria-label="Tutup" />
          <div className="anim-sheet relative mx-auto w-full max-w-md rounded-t-[24px] border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <h3 className="pb-3 text-sm font-extrabold">{form.id ? (lang === "id" ? "Ubah dompet" : "Edit wallet") : (lang === "id" ? "Tambah dompet" : "Add wallet")}</h3>
            <label className="block pb-2.5">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Nama dompet" : "Wallet name"}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === "id" ? "mis. BCA, GoPay" : "e.g. BCA, GoPay"} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border" />
            </label>
            {!form.id && (
              <label className="block pb-2.5">
                <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Saldo awal" : "Initial balance"}</span>
                <input inputMode="numeric" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value.replace(/\D/g, "") })} placeholder="0" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-border" />
              </label>
            )}
            <p className="pb-1 text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Warna" : "Color"}</p>
            <div className="flex flex-wrap gap-1.5 pb-2.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c} className={cn("h-7 w-7 rounded-full transition-transform", form.color === c && "scale-110 ring-2 ring-offset-2 ring-offset-card")} style={{ backgroundColor: c, boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined }} />
              ))}
            </div>
            <p className="pb-1 text-[11px] font-bold text-muted-foreground">Ikon</p>
            <div className="grid grid-cols-8 gap-1 overflow-y-auto thin-scroll max-h-24 pb-2.5">
              {ICON_NAMES.map((n) => (
                <button key={n} onClick={() => setForm({ ...form, icon: n })} aria-label={n} className={cn("flex h-8 items-center justify-center rounded-lg", form.icon === n ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "bg-surface2 text-muted-foreground")}>
                  <Icon name={n} size={15} />
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setForm({ ...form, open: false })} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Batal" : "Cancel"}</button>
              <button
                disabled={!form.name.trim()}
                onClick={async () => { await saveWallet({ id: form.id, name: form.name, icon: form.icon, color: form.color, initialBalance: Number(form.initialBalance) }); setForm({ ...form, open: false }); }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
              >
                {lang === "id" ? "Simpan" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TARGET TABUNGAN
// ════════════════════════════════════════════════════════════
export function GoalsView({ onBack }: { onBack: () => void }) {
  const lang = useLang((s) => s.lang);
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.deleted).toArray(), []);
  const [form, setForm] = useState<{ open: boolean; id?: string; name: string; target: string; current: string; deadline: string; icon: string; color: string }>({ open: false, name: "", target: "", current: "", deadline: "", icon: "piggy-bank", color: PALETTE[0] });
  const [addId, setAddId] = useState<{ id: string; amount: string } | null>(null);

  return (
    <div className="space-y-3">
      <SubHeader title={lang === "id" ? "Target Tabungan" : "Savings Goals"} desc={lang === "id" ? "Nabung untuk tujuan tertentu" : "Save toward something specific"} onBack={onBack} />

      <div className="space-y-2">
        {(goals ?? []).map((g) => {
          const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
          return (
            <Card key={g.id} className="p-4">
              <div className="flex items-center gap-2.5">
                <IconBubble name={g.icon} color={g.color} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{g.name} {g.status === "achieved" && <span className="ml-1 rounded-full bg-ok/15 px-1.5 py-0.5 text-[9px] font-extrabold text-ok">✓</span>}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <MoneyText amount={g.currentAmount} className="font-semibold text-foreground/80" /> {lang === "id" ? "dari" : "of"} <MoneyText amount={g.targetAmount} className="font-semibold text-foreground/80" />
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAddId({ id: g.id, amount: "" })} className="rounded-full bg-primary/12 px-2.5 py-1.5 text-[10px] font-extrabold text-primary">+ {lang === "id" ? "Dana" : "Funds"}</button>
                  <button onClick={() => setForm({ open: true, id: g.id, name: g.name, target: String(g.targetAmount), current: String(g.currentAmount), deadline: g.deadline ?? "", icon: g.icon, color: g.color })} aria-label="Ubah" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm(lang === "id" ? "Hapus target ini?" : "Delete this goal?")) void deleteGoal(g.id); }} aria-label="Hapus" className="flex h-8 w-8 items-center justify-center rounded-lg text-bad hover:bg-bad/10"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-2.5"><ProgressBar percent={pct} /></div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span className="font-bold text-foreground/70">{Math.round(pct)}%</span>
                {g.deadline && <span>{lang === "id" ? "Tenggat" : "Deadline"}: {g.deadline.split("-").reverse().join("/")}</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {(goals ?? []).length === 0 && (
        <EmptyState icon={<TargetIcon size={20} />} title={lang === "id" ? "Belum ada target" : "No goals yet"} desc={lang === "id" ? "Buat target untuk dana darurat, liburan, atau gadget" : "Create a goal for an emergency fund, a trip, or a gadget"} />
      )}

      <button
        onClick={() => setForm({ open: true, name: "", target: "", current: "", deadline: "", icon: "piggy-bank", color: PALETTE[(goals?.length ?? 0) % PALETTE.length] })}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 text-xs font-bold text-primary"
      >
        <Plus size={15} /> {lang === "id" ? "Tambah target" : "Add goal"}
      </button>

      {/* Tambah dana */}
      {addId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button className="absolute inset-0 bg-black/45" onClick={() => setAddId(null)} aria-label="Tutup" />
          <div className="anim-sheet relative mx-auto w-full max-w-md rounded-t-[24px] border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <h3 className="pb-3 text-sm font-extrabold">{lang === "id" ? "Tambah dana" : "Add funds"}</h3>
            <input inputMode="numeric" value={addId.amount} onChange={(e) => setAddId({ ...addId, amount: e.target.value.replace(/\D/g, "") })} placeholder="0" className="w-full rounded-xl bg-surface2 px-3 py-3 text-center text-lg font-extrabold outline-none ring-1 ring-border" />
            <div className="flex gap-2 pt-3">
              <button onClick={() => setAddId(null)} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Batal" : "Cancel"}</button>
              <button
                disabled={!Number(addId.amount)}
                onClick={async () => { await addToGoal(addId.id, Number(addId.amount)); setAddId(null); }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
              >
                {lang === "id" ? "Tambah" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form target */}
      {form.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button className="absolute inset-0 bg-black/45" onClick={() => setForm({ ...form, open: false })} aria-label="Tutup" />
          <div className="anim-sheet relative mx-auto w-full max-w-md rounded-t-[24px] border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <h3 className="pb-3 text-sm font-extrabold">{form.id ? (lang === "id" ? "Ubah target" : "Edit goal") : (lang === "id" ? "Tambah target" : "Add goal")}</h3>
            <label className="block pb-2.5">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Nama" : "Name"}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === "id" ? "mis. Dana darurat" : "e.g. Emergency fund"} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border" />
            </label>
            <div className="grid grid-cols-2 gap-2 pb-2.5">
              <label className="block">
                <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Target" : "Target"}</span>
                <input inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/\D/g, "") })} placeholder="0" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-border" />
              </label>
              <label className="block">
                <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Terkumpul" : "Saved"}</span>
                <input inputMode="numeric" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value.replace(/\D/g, "") })} placeholder="0" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-border" />
              </label>
            </div>
            <label className="block pb-3">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Tenggat (opsional)" : "Deadline (optional)"}</span>
              <input type="date" value={form.deadline} min={todayStr()} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border" />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, open: false })} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Batal" : "Cancel"}</button>
              <button
                disabled={!form.name.trim() || !Number(form.target)}
                onClick={async () => { await saveGoal({ id: form.id, name: form.name, targetAmount: Number(form.target), currentAmount: Number(form.current), deadline: form.deadline || null, icon: form.icon, color: form.color }); setForm({ ...form, open: false }); }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
              >
                {lang === "id" ? "Simpan" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// KATEGORI
// ════════════════════════════════════════════════════════════
export function CategoriesView({ onBack }: { onBack: () => void }) {
  const lang = useLang((s) => s.lang);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const [form, setForm] = useState<{ open: boolean; id?: string; name: string; type: "income" | "expense"; icon: string; color: string }>({ open: false, name: "", type: "expense", icon: "shapes", color: PALETTE[0] });

  const grouped = {
    expense: (cats ?? []).filter((c) => c.type === "expense"),
    income: (cats ?? []).filter((c) => c.type === "income"),
  };

  return (
    <div className="space-y-3">
      <SubHeader title={lang === "id" ? "Kategori" : "Categories"} desc={lang === "id" ? "Kelola jenis pemasukan & pengeluaran" : "Manage income & expense types"} onBack={onBack} />

      {(["expense", "income"] as const).map((t) => (
        <section key={t}>
          <p className="px-1 pb-1.5 text-[11px] font-bold text-muted-foreground">{t === "expense" ? (lang === "id" ? "Pengeluaran" : "Expense") : (lang === "id" ? "Pemasukan" : "Income")}</p>
          <div className="grid grid-cols-2 gap-2">
            {grouped[t].map((c) => (
              <Card key={c.id} className="flex items-center gap-2 p-2.5">
                <IconBubble name={c.icon} color={c.color} size={30} />
                <p className="min-w-0 flex-1 truncate text-xs font-bold">{c.name}</p>
                <div className="flex flex-col">
                  <button onClick={() => setForm({ open: true, id: c.id, name: c.name, type: c.type, icon: c.icon, color: c.color })} aria-label="Ubah" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"><Pencil size={11} /></button>
                  <button onClick={() => { if (confirm(lang === "id" ? "Hapus kategori ini?" : "Delete this category?")) void deleteCategory(c.id); }} aria-label="Hapus" className="flex h-6 w-6 items-center justify-center rounded-md text-bad hover:bg-bad/10"><Trash2 size={11} /></button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <button
        onClick={() => setForm({ open: true, name: "", type: "expense", icon: "shapes", color: PALETTE[(cats?.length ?? 0) % PALETTE.length] })}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 text-xs font-bold text-primary"
      >
        <Plus size={15} /> {lang === "id" ? "Tambah kategori" : "Add category"}
      </button>

      {form.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button className="absolute inset-0 bg-black/45" onClick={() => setForm({ ...form, open: false })} aria-label="Tutup" />
          <div className="anim-sheet relative mx-auto w-full max-w-md rounded-t-[24px] border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <h3 className="pb-3 text-sm font-extrabold">{form.id ? (lang === "id" ? "Ubah kategori" : "Edit category") : (lang === "id" ? "Tambah kategori" : "Add category")}</h3>
            <div className="mb-2.5 grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1">
              {(["expense", "income"] as const).map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t })} className={cn("rounded-lg py-2 text-xs font-bold", form.type === t ? "bg-card shadow-sm" : "text-muted-foreground")}>
                  {t === "expense" ? (lang === "id" ? "Pengeluaran" : "Expense") : (lang === "id" ? "Pemasukan" : "Income")}
                </button>
              ))}
            </div>
            <label className="block pb-2.5">
              <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Nama kategori" : "Category name"}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === "id" ? "mis. Langganan" : "e.g. Subscriptions"} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border" />
            </label>
            <p className="pb-1 text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Warna" : "Color"}</p>
            <div className="flex flex-wrap gap-1.5 pb-2.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c} className={cn("h-7 w-7 rounded-full", form.color === c && "scale-110")} style={{ backgroundColor: c, boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined }} />
              ))}
            </div>
            <p className="pb-1 text-[11px] font-bold text-muted-foreground">Ikon</p>
            <div className="grid grid-cols-8 gap-1 overflow-y-auto thin-scroll max-h-24 pb-2.5">
              {ICON_NAMES.map((n) => (
                <button key={n} onClick={() => setForm({ ...form, icon: n })} aria-label={n} className={cn("flex h-8 items-center justify-center rounded-lg", form.icon === n ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "bg-surface2 text-muted-foreground")}>
                  <Icon name={n} size={15} />
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setForm({ ...form, open: false })} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Batal" : "Cancel"}</button>
              <button
                disabled={!form.name.trim()}
                onClick={async () => { await saveCategory({ id: form.id, name: form.name, type: form.type, icon: form.icon, color: form.color }); setForm({ ...form, open: false }); }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
              >
                {lang === "id" ? "Simpan" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
