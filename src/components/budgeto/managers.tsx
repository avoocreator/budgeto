// ============================================================
// BUDGETO v2 — Manager: Target Tabungan, Budget, Dompet, Kategori
// ============================================================

"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { saveGoal, deleteGoal, addToGoal, saveBudget, deleteBudget, saveWallet, deleteWallet, saveCategory, deleteCategory } from "@/lib/repo";
import { formatMoney, monthLabel, monthStr } from "@/lib/format";
import { PALETTE } from "@/lib/types";
import { Card, CatIcon, EmptyState, ProgressBar, SectionTitle, ICON_CHOICES, ICON_MAP } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Target, Plus, Trash2, Pencil, Wallet as WalletIcon, Tags, PiggyBank, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Budget, Category, Goal, Wallet } from "@/lib/types";

// ─── Helper kecil ────────────────────────────────────────────
function ManagerHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={onBack} aria-label="Kembali">
        <ChevronLeft size={20} />
      </Button>
      <div>
        <h1 className="text-base font-bold leading-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="thin-scroll grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded-xl border p-2">
      {ICON_CHOICES.map((name) => {
        const Icon = ICON_MAP[name];
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn("flex h-8 items-center justify-center rounded-lg transition-colors", value === name ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted")}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={cn("h-7 w-7 rounded-full transition-transform", value === c ? "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-background" : "")}
          aria-label={`Warna ${c}`}
        />
      ))}
    </div>
  );
}

function AmountInput({ value, onChange, currency, placeholder }: { value: string; onChange: (v: string) => void; currency: string; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency === "IDR" ? "Rp" : currency}</span>
      <Input
        inputMode="numeric"
        value={value === "" ? "" : Number(value.replace(/[^\d]/g, "")).toLocaleString("id-ID")}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        placeholder={placeholder ?? "0"}
        className="h-9 rounded-xl pl-9 text-sm tnum"
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// TARGET TABUNGAN
// ═════════════════════════════════════════════════════════════
export function GoalsView({ onBack }: { onBack: () => void }) {
  const currency = useSettings((s) => s.currency);
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const [form, setForm] = useState<Partial<Goal> | null>(null);
  const [addMoney, setAddMoney] = useState<{ goal: Goal; amount: string; walletId: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("piggy-bank");
  const [color, setColor] = useState<string>(PALETTE[0]);

  const list = useMemo(() => (goals ?? []).filter((g) => !g.deleted).sort((a, b) => b.createdAt - a.createdAt), [goals]);

  function openForm(g?: Goal) {
    setName(g?.name ?? "");
    setTarget(g?.targetAmount ? String(g.targetAmount) : "");
    setCurrent(g?.currentAmount ? String(g.currentAmount) : "");
    setDeadline(g?.deadline ?? "");
    setIcon(g?.icon ?? "piggy-bank");
    setColor(g?.color ?? PALETTE[0]);
    setForm(g ?? {});
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Beri nama targetnya dulu"); return; }
    if (Number(target || 0) <= 0) { toast.error("Isi nominal target"); return; }
    await saveGoal({
      id: form?.id, name, targetAmount: Number(target || 0), currentAmount: Number(current || 0),
      deadline: deadline || null, icon, color,
      status: form?.status,
    });
    toast.success(form?.id ? "Target diperbarui" : "Target baru dibuat");
    setForm(null);
  }

  return (
    <div className="space-y-3">
      <ManagerHeader title="Target Tabungan" subtitle="Sisihkan uang untuk tujuanmu" onBack={onBack} />

      <Button className="h-10 w-full rounded-xl text-sm font-semibold" onClick={() => openForm()}>
        <Plus size={16} className="mr-1" /> Target Baru
      </Button>

      {list.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Belum ada target" subtitle="Contoh: Dana darurat, beli HP baru, liburan" />
      ) : (
        list.map((g) => {
          const pct = Math.min(100, Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100));
          const achieved = g.status === "achieved";
          return (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CatIcon name={g.icon} color={g.color} size={18} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{g.name} {achieved && "🎉"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Target {formatMoney(g.targetAmount, currency, { compact: true })}{g.deadline ? ` · s/d ${monthLabel(g.deadline.slice(0, 7))} ${g.deadline.slice(8)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" onClick={() => openForm(g)} aria-label="Edit"><Pencil size={14} /></button>
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setConfirmDelete(g)} aria-label="Hapus"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="tnum mt-2 text-lg font-bold">{formatMoney(g.currentAmount, currency)} <span className="text-xs font-medium text-muted-foreground">/ {formatMoney(g.targetAmount, currency)}</span></p>
              <ProgressBar percent={pct} color={g.color} className="mt-2" />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{pct}% tercapai</span>
                {!achieved && (
                  <Button size="sm" className="h-7 rounded-lg px-3 text-xs" onClick={() => setAddMoney({ goal: g, amount: "", walletId: wallets?.[0]?.id ?? null })}>
                    <Plus size={12} className="mr-0.5" /> Setor
                  </Button>
                )}
              </div>
            </Card>
          );
        })
      )}

      {/* Form target */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Target size={16} /> {form?.id ? "Edit Target" : "Target Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama target (misal: Dana Darurat)" className="h-9 rounded-xl text-sm" maxLength={40} />
            <AmountInput value={target} onChange={setTarget} currency={currency} placeholder="Nominal target" />
            <AmountInput value={current} onChange={setCurrent} currency={currency} placeholder="Sudah terkumpul" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Tenggat: <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs outline-none [color-scheme:light] dark:[color-scheme:dark]" />
            </div>
            <IconPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setForm(null)}>Batal</Button>
            <Button className="h-9 flex-1 rounded-xl" onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setor uang */}
      <Dialog open={addMoney !== null} onOpenChange={(o) => !o && setAddMoney(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="text-base">Setor ke &quot;{addMoney?.goal.name}&quot;</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <AmountInput value={addMoney?.amount ?? ""} onChange={(v) => setAddMoney((s) => (s ? { ...s, amount: v } : s))} currency={currency} />
            <select
              value={addMoney?.walletId ?? ""}
              onChange={(e) => setAddMoney((s) => (s ? { ...s, walletId: e.target.value } : s))}
              className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-none"
            >
              <option value="" disabled>Uang diambil dari...</option>
              {(wallets ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">Setoran juga tercatat sebagai pengeluaran di dompet yang dipilih.</p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setAddMoney(null)}>Batal</Button>
            <Button className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (!addMoney) return;
              const amt = Number(addMoney.amount || 0);
              if (amt <= 0) { toast.error("Isi nominalnya dulu"); return; }
              await addToGoal(addMoney.goal.id, amt, addMoney.walletId);
              toast.success("Berhasil disetor 🎉");
              setAddMoney(null);
            }}>Setor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hapus */}
      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Trash2 size={15} className="text-expense" /> Hapus target?</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Progres tabungan &quot;{confirmDelete?.name}&quot; akan hilang dari daftar.</p>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="destructive" className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (confirmDelete) { await deleteGoal(confirmDelete.id); toast.success("Target dihapus"); }
              setConfirmDelete(null);
            }}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// BUDGET
// ═════════════════════════════════════════════════════════════
export function BudgetsView({ onBack }: { onBack: () => void }) {
  const currency = useSettings((s) => s.currency);
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const categories = useLiveQuery(() => db.categories.filter((c) => !c.deleted && c.type === "expense").toArray(), []);
  const [form, setForm] = useState<{ budget?: Budget } | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Budget | null>(null);

  const month = monthStr(0);
  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs ?? []) {
      if (t.deleted || t.type !== "expense" || !t.date.startsWith(month) || !t.categoryId) continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    }
    return map;
  }, [txs, month]);

  const list = (budgets ?? []).filter((b) => !b.deleted);

  async function handleSave() {
    if (!categoryId) { toast.error("Pilih kategorinya dulu"); return; }
    if (Number(amount || 0) <= 0) { toast.error("Isi nominal budget"); return; }
    const dup = list.find((b) => b.categoryId === categoryId && b.id !== form?.budget?.id);
    if (dup) { toast.error("Kategori ini sudah punya budget"); return; }
    await saveBudget({ id: form?.budget?.id, categoryId, amount: Number(amount) });
    toast.success(form?.budget ? "Budget diperbarui" : "Budget dibuat");
    setForm(null);
  }

  const totalBudget = list.reduce((s, b) => s + b.amount, 0);
  const totalSpent = list.reduce((s, b) => s + (spentByCat.get(b.categoryId) ?? 0), 0);

  return (
    <div className="space-y-3">
      <ManagerHeader title="Budget Bulanan" subtitle="Batas belanja per kategori" onBack={onBack} />

      {list.length > 0 && (
        <Card>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Terpakai bulan ini</span>
            <span className="tnum font-semibold">{formatMoney(totalSpent, currency)} / {formatMoney(totalBudget, currency)}</span>
          </div>
          <ProgressBar percent={totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0} className="mt-2" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {totalBudget - totalSpent >= 0 ? `Sisa ${formatMoney(totalBudget - totalSpent, currency)}` : `Lewat ${formatMoney(totalSpent - totalBudget, currency)}`} dari total budget {monthLabel(month, true)}
          </p>
        </Card>
      )}

      <Button className="h-10 w-full rounded-xl text-sm font-semibold" onClick={() => { setCategoryId(categories?.[0]?.id ?? ""); setAmount(""); setForm({}); }}>
        <Plus size={16} className="mr-1" /> Budget Baru
      </Button>

      {list.length === 0 ? (
        <EmptyState icon={WalletIcon} title="Belum ada budget" subtitle="Batas pengeluaran per kategori, misal Makan 1.500.000" />
      ) : (
        list.map((b) => {
          const cat = categories?.find((c) => c.id === b.categoryId);
          const spent = spentByCat.get(b.categoryId) ?? 0;
          const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
          return (
            <Card key={b.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CatIcon name={cat?.icon ?? "shapes"} color={cat?.color} size={18} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{cat?.name ?? "Kategori"}</p>
                    <p className="tnum text-[11px] text-muted-foreground">{formatMoney(spent, currency)} terpakai</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="tnum text-sm font-semibold">{formatMoney(b.amount, currency, { compact: true })}</span>
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" onClick={() => { setCategoryId(b.categoryId); setAmount(String(b.amount)); setForm({ budget: b }); }} aria-label="Edit"><Pencil size={14} /></button>
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setConfirmDelete(b)} aria-label="Hapus"><Trash2 size={14} /></button>
                </div>
              </div>
              <ProgressBar percent={pct} color={cat?.color} className="mt-2" />
              <p className={cn("mt-1 text-[11px]", pct >= 100 ? "text-expense font-medium" : "text-muted-foreground")}>
                {pct >= 100 ? `Lewat ${pct - 100}% dari budget!` : `${pct}% terpakai`}
              </p>
            </Card>
          );
        })
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="text-base">{form?.budget ? "Edit Budget" : "Budget Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-none">
              <option value="" disabled>Pilih kategori pengeluaran</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <AmountInput value={amount} onChange={setAmount} currency={currency} placeholder="Batas per bulan" />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setForm(null)}>Batal</Button>
            <Button className="h-9 flex-1 rounded-xl" onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Trash2 size={15} className="text-expense" /> Hapus budget?</DialogTitle></DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="destructive" className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (confirmDelete) { await deleteBudget(confirmDelete.id); toast.success("Budget dihapus"); }
              setConfirmDelete(null);
            }}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// DOMPET
// ═════════════════════════════════════════════════════════════
export function WalletsView({ onBack }: { onBack: () => void }) {
  const currency = useSettings((s) => s.currency);
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.toArray(), []);
  const [form, setForm] = useState<{ wallet?: Wallet } | null>(null);
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [icon, setIcon] = useState("wallet");
  const [color, setColor] = useState<string>(PALETTE[4]);
  const [confirmDelete, setConfirmDelete] = useState<Wallet | null>(null);

  function balanceOf(w: Wallet): number {
    let bal = w.initialBalance;
    for (const t of txs ?? []) {
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

  function openForm(w?: Wallet) {
    setName(w?.name ?? "");
    setInitial(w?.initialBalance ? String(w.initialBalance) : "");
    setIcon(w?.icon ?? "wallet");
    setColor(w?.color ?? PALETTE[4]);
    setForm(w ? { wallet: w } : {});
  }

  const live = (wallets ?? []).filter((w) => !w.deleted);
  const total = live.reduce((s, w) => s + balanceOf(w), 0);

  return (
    <div className="space-y-3">
      <ManagerHeader title="Dompet & Akun" subtitle="Tunai, bank, e-wallet — terpisah rapi" onBack={onBack} />

      <Card className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total semua dompet</span>
        <span className="tnum text-base font-bold">{formatMoney(total, currency)}</span>
      </Card>

      <Button className="h-10 w-full rounded-xl text-sm font-semibold" onClick={() => openForm()}>
        <Plus size={16} className="mr-1" /> Dompet Baru
      </Button>

      {live.length === 0 ? (
        <EmptyState icon={WalletIcon} title="Belum ada dompet" subtitle="Tambahkan dompet untuk mulai mencatat" />
      ) : (
        live.map((w) => (
          <Card key={w.id} className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <CatIcon name={w.icon} color={w.color} size={18} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{w.name}</p>
                <p className="text-[11px] text-muted-foreground">Saldo awal {formatMoney(w.initialBalance, currency)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tnum text-sm font-semibold">{formatMoney(balanceOf(w), currency)}</span>
              <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" onClick={() => openForm(w)} aria-label="Edit"><Pencil size={14} /></button>
              <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" onClick={() => setConfirmDelete(w)} aria-label="Hapus"><Trash2 size={14} /></button>
            </div>
          </Card>
        ))
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="text-base">{form?.wallet ? "Edit Dompet" : "Dompet Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama dompet (misal: GoPay)" className="h-9 rounded-xl text-sm" maxLength={30} />
            <AmountInput value={initial} onChange={setInitial} currency={currency} placeholder="Saldo awal" />
            <IconPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setForm(null)}>Batal</Button>
            <Button className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (!name.trim()) { toast.error("Beri nama dompetnya"); return; }
              await saveWallet({ id: form?.wallet?.id, name, icon, color, initialBalance: Number(initial || 0) });
              toast.success(form?.wallet ? "Dompet diperbarui" : "Dompet dibuat");
              setForm(null);
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Trash2 size={15} className="text-expense" /> Hapus dompet?</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Dompet &quot;{confirmDelete?.name}&quot; disembunyikan. Riwayat transaksinya tetap tersimpan.</p>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="destructive" className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (confirmDelete) { await deleteWallet(confirmDelete.id); toast.success("Dompet dihapus"); }
              setConfirmDelete(null);
            }}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// KATEGORI
// ═════════════════════════════════════════════════════════════
export function CategoriesView({ onBack }: { onBack: () => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const [form, setForm] = useState<{ cat?: Category } | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [icon, setIcon] = useState("utensils");
  const [color, setColor] = useState<string>(PALETTE[1]);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  function openForm(c?: Category) {
    setName(c?.name ?? "");
    setType(c?.type ?? "expense");
    setIcon(c?.icon ?? "utensils");
    setColor(c?.color ?? PALETTE[1]);
    setForm(c ? { cat: c } : {});
  }

  const live = (categories ?? []).filter((c) => !c.deleted);
  const expense = live.filter((c) => c.type === "expense");
  const income = live.filter((c) => c.type === "income");

  return (
    <div className="space-y-3">
      <ManagerHeader title="Kategori" subtitle="Atur jenis pemasukan & pengeluaranmu" onBack={onBack} />

      <Button className="h-10 w-full rounded-xl text-sm font-semibold" onClick={() => openForm()}>
        <Plus size={16} className="mr-1" /> Kategori Baru
      </Button>

      {live.length === 0 ? (
        <EmptyState icon={Tags} title="Belum ada kategori" />
      ) : (
        <>
          <section>
            <SectionTitle title="Pengeluaran" />
            <div className="grid grid-cols-2 gap-2">
              {expense.map((c) => <CatChip key={c.id} c={c} onEdit={() => openForm(c)} onDelete={() => setConfirmDelete(c)} />)}
            </div>
          </section>
          <section>
            <SectionTitle title="Pemasukan" />
            <div className="grid grid-cols-2 gap-2">
              {income.map((c) => <CatChip key={c.id} c={c} onEdit={() => openForm(c)} onDelete={() => setConfirmDelete(c)} />)}
            </div>
          </section>
        </>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="text-base">{form?.cat ? "Edit Kategori" : "Kategori Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kategori" className="h-9 rounded-xl text-sm" maxLength={30} />
            <div className="flex gap-2">
              {(["expense", "income"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={cn("flex-1 rounded-xl border py-2 text-xs font-medium", type === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                  {t === "expense" ? "Pengeluaran" : "Pemasukan"}
                </button>
              ))}
            </div>
            <IconPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setForm(null)}>Batal</Button>
            <Button className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (!name.trim()) { toast.error("Beri nama kategorinya"); return; }
              await saveCategory({ id: form?.cat?.id, name, type, icon, color });
              toast.success(form?.cat ? "Kategori diperbarui" : "Kategori dibuat");
              setForm(null);
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Trash2 size={15} className="text-expense" /> Hapus kategori?</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Transaksi lama dengan kategori ini tetap tersimpan (kategori ditampilkan kosong).</p>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="h-9 flex-1 rounded-xl" onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button variant="destructive" className="h-9 flex-1 rounded-xl" onClick={async () => {
              if (confirmDelete) { await deleteCategory(confirmDelete.id); toast.success("Kategori dihapus"); }
              setConfirmDelete(null);
            }}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CatChip({ c, onEdit, onDelete }: { c: Category; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="flex items-center justify-between gap-1 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <CatIcon name={c.icon} color={c.color} size={15} />
        <span className="truncate text-xs font-medium">{c.name}</span>
      </div>
      <div className="flex shrink-0">
        <button className="rounded-lg p-1 text-muted-foreground hover:bg-muted" onClick={onEdit} aria-label="Edit"><Pencil size={13} /></button>
        <button className="rounded-lg p-1 text-muted-foreground hover:bg-muted" onClick={onDelete} aria-label="Hapus"><Trash2 size={13} /></button>
      </div>
    </Card>
  );
}
