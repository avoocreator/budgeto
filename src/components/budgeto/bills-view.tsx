// ============================================================
// BUDGETO v3 — Tagihan & Rutinitas (F06)
// Aturan berulang (mingguan/bulanan): mode "catat otomatis" atau
// "minta konfirmasi". Tagihan menunggu bisa dikonfirmasi, diubah
// nominalnya, atau dilewati. Pengingat H-1 lewat notifikasi.
// ============================================================

"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { saveRecurringRule, deleteRecurringRule } from "@/lib/repo";
import { confirmPendingBill, skipPendingBill, nextOccurrence } from "@/lib/recurring";
import { useLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { todayStr, addDays } from "@/lib/format";
import type { RecurringRule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, MoneyText, EmptyState, IconBubble, Segmented } from "./ui-bits";
import { ArrowLeft, Plus, Pencil, Trash2, CalendarClock, Repeat, Power } from "lucide-react";

export function BillsView({ onBack }: { onBack: () => void }) {
  const lang = useLang((s) => s.lang);
  const rules = useLiveQuery(() => db.recurringRules.filter((r) => !r.deleted).toArray(), []);
  const cats = useLiveQuery(() => db.categories.filter((c) => !c.deleted).toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);
  const lastWalletId = useSettings((s) => s.lastWalletId);

  const [form, setForm] = useState<{ open: boolean; edit?: RecurringRule } | null>(null);

  const pending = (rules ?? []).filter((r) => !r.deleted).flatMap((r) => r.pending.map((p) => ({ rule: r, bill: p })));
  const active = (rules ?? []).filter((r) => !r.deleted);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 pb-1">
        <button onClick={onBack} aria-label="Kembali" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border">
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{lang === "id" ? "Tagihan & Rutinitas" : "Bills & Recurring"}</h1>
          <p className="text-[11px] leading-snug text-muted-foreground">{lang === "id" ? "Aturan berulang: tagihan otomatis atau minta konfirmasi" : "Recurring rules: auto-posted or confirmation first"}</p>
        </div>
      </div>

      {/* Tagihan menunggu konfirmasi */}
      {pending.length > 0 && (
        <section>
          <p className="px-1 pb-1.5 text-[11px] font-bold text-warn">{lang === "id" ? "Tagihan menunggu konfirmasi" : "Bills awaiting confirmation"}</p>
          <div className="space-y-2">
            {pending.map(({ rule, bill }) => (
              <Card key={bill.id} className="p-4">
                <div className="flex items-center gap-2.5">
                  <IconBubble name="calendar-clock" color="var(--status-warn)" size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{rule.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {lang === "id" ? "Jatuh tempo" : "Due"} {bill.dueDate.split("-").reverse().join("/")}
                    </p>
                  </div>
                  <MoneyText amount={bill.amount} className="text-[13px] font-extrabold" />
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    onClick={() => void confirmPendingBill(rule.id, bill.id)}
                    className="flex-1 rounded-xl bg-primary py-2 text-[11px] font-extrabold text-primary-foreground"
                  >
                    {lang === "id" ? "Konfirmasi" : "Confirm"}
                  </button>
                  <button
                    onClick={() => { const v = prompt(lang === "id" ? "Nominal baru (kosongkan bila tetap):" : "New amount (empty to keep):", String(bill.amount)); if (v && Number(v) > 0) void confirmPendingBill(rule.id, bill.id, Number(v)); }}
                    className="flex-1 rounded-xl bg-surface2 py-2 text-[11px] font-bold text-foreground"
                  >
                    {lang === "id" ? "Ubah nominal" : "Change amount"}
                  </button>
                  <button
                    onClick={() => void skipPendingBill(rule.id, bill.id)}
                    className="flex-1 rounded-xl bg-surface2 py-2 text-[11px] font-bold text-muted-foreground"
                  >
                    {lang === "id" ? "Lewati" : "Skip"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Daftar aturan */}
      <section>
        <p className="px-1 pb-1.5 text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Aturan berulang" : "Recurring rules"}</p>
        <div className="space-y-2">
          {active.map((r) => {
            const cat = cats?.find((c) => c.id === r.categoryId);
            return (
              <Card key={r.id} className={cn("p-3.5", !r.active && "opacity-55")}>
                <div className="flex items-center gap-2.5">
                  <IconBubble name={cat?.icon ?? "repeat"} color={cat?.color ?? "#64748b"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.frequency === "weekly"
                        ? `${lang === "id" ? "Mingguan" : "Weekly"} · ${dayName(r.weekday ?? 0, lang)}`
                        : `${lang === "id" ? "Bulanan" : "Monthly"} · tgl ${r.dayOfMonth ?? 1}`}
                      {" · "}
                      {r.mode === "auto" ? (lang === "id" ? "otomatis" : "auto") : (lang === "id" ? "konfirmasi" : "confirm")}
                    </p>
                  </div>
                  <div className="text-right">
                    <MoneyText amount={r.amount} className={cn("text-[13px] font-extrabold", r.type === "income" ? "text-income" : "text-expense")} />
                    <p className="text-[9px] text-muted-foreground">→ {r.nextDate.split("-").reverse().join("/")}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    onClick={async () => { await db.recurringRules.update(r.id, { active: !r.active, updatedAt: Date.now() }); }}
                    className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold", r.active ? "bg-ok/12 text-ok" : "bg-surface2 text-muted-foreground")}
                  >
                    <Power size={10} /> {r.active ? (lang === "id" ? "Aktif" : "Active") : (lang === "id" ? "Nonaktif" : "Inactive")}
                  </button>
                  <button onClick={() => setForm({ open: true, edit: r })} aria-label="Ubah" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm(lang === "id" ? "Hapus aturan? Transaksi yang sudah tercatat tidak ikut terhapus." : "Delete rule? Recorded transactions are kept.")) void deleteRecurringRule(r.id); }} aria-label="Hapus" className="flex h-7 w-7 items-center justify-center rounded-lg text-bad hover:bg-bad/10"><Trash2 size={13} /></button>
                </div>
              </Card>
            );
          })}
          {active.length === 0 && (
            <EmptyState icon={<Repeat size={20} />} title={lang === "id" ? "Belum ada aturan berulang" : "No recurring rules yet"} desc={lang === "id" ? "Buat sekali, dicatat sendiri setiap periodenya" : "Create once, posted automatically each period"} />
          )}
        </div>
      </section>

      <button
        onClick={() => setForm({ open: true })}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 text-xs font-bold text-primary"
      >
        <Plus size={15} /> {lang === "id" ? "Tambah aturan" : "Add rule"}
      </button>

      {/* Form aturan */}
      {form?.open && (
        <RuleForm
          edit={form.edit}
          lang={lang}
          defaultWalletId={lastWalletId || wallets?.[0]?.id || ""}
          onClose={() => setForm(null)}
          cats={(cats ?? []).filter((c) => !!c)}
          wallets={wallets ?? []}
        />
      )}
    </div>
  );
}

function dayName(d: number, lang: "id" | "en"): string {
  const names = lang === "id"
    ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[d];
}

function RuleForm({ edit, lang, cats, wallets, defaultWalletId, onClose }: {
  edit?: RecurringRule; lang: "id" | "en"; cats: { id: string; name: string; type: "income" | "expense" }[];
  wallets: { id: string; name: string }[]; defaultWalletId: string; onClose: () => void;
}) {
  const [name, setName] = useState(edit?.name ?? "");
  const [type, setType] = useState<"expense" | "income">(edit?.type ?? "expense");
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [categoryId, setCategoryId] = useState(edit?.categoryId ?? cats.find((c) => c.type === (edit?.type ?? "expense"))?.id ?? "");
  const [walletId, setWalletId] = useState(edit?.walletId ?? defaultWalletId);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">(edit?.frequency ?? "monthly");
  const [dayOfMonth, setDayOfMonth] = useState(edit?.dayOfMonth ?? Number(todayStr().split("-")[2]));
  const [weekday, setWeekday] = useState(edit?.weekday ?? new Date().getDay());
  const [mode, setMode] = useState<"auto" | "confirm">(edit?.mode ?? "auto");
  const [nextDate, setNextDate] = useState<string>(edit?.nextDate ?? "");
  const [remind, setRemind] = useState(edit?.remindDaysBefore ?? 1);
  const [saving, setSaving] = useState(false);

  const catList = cats.filter((c) => c.type === type);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Tutup" />
      <div className="anim-sheet thin-scroll relative mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border bg-card p-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        <h3 className="pb-3 text-sm font-extrabold">{edit ? (lang === "id" ? "Ubah aturan" : "Edit rule") : (lang === "id" ? "Tambah aturan" : "Add rule")}</h3>

        <label className="block pb-2.5">
          <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Nama tagihan" : "Bill name"}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "id" ? "mis. Kos, Netflix" : "e.g. Rent, Netflix"} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border" />
        </label>

        <Segmented
          value={type}
          onChange={(t) => { setType(t); setCategoryId(cats.find((c) => c.type === t)?.id ?? ""); }}
          options={[
            { value: "expense", label: lang === "id" ? "Pengeluaran" : "Expense" },
            { value: "income", label: lang === "id" ? "Pemasukan" : "Income" },
          ]}
          className="mb-2.5"
        />

        <label className="block pb-2.5">
          <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Nominal" : "Amount"}</span>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-border" />
        </label>

        <div className="grid grid-cols-2 gap-2 pb-2.5">
          <label className="block">
            <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Kategori" : "Category"}</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl bg-surface2 px-2.5 py-2.5 text-xs font-semibold outline-none">
              {catList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Dompet" : "Wallet"}</span>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className="w-full rounded-xl bg-surface2 px-2.5 py-2.5 text-xs font-semibold outline-none">
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        </div>

        <Segmented
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: "monthly", label: lang === "id" ? "Bulanan" : "Monthly" },
            { value: "weekly", label: lang === "id" ? "Mingguan" : "Weekly" },
          ]}
          className="mb-2.5"
        />

        {frequency === "monthly" ? (
          <label className="block pb-2.5">
            <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Tanggal (1–31, aman untuk 29–31)" : "Day (1–31, safe for 29–31)"}</span>
            <input inputMode="numeric" value={dayOfMonth} onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-bold outline-none ring-1 ring-border" />
          </label>
        ) : (
          <div className="pb-2.5">
            <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Hari" : "Weekday"}</span>
            <div className="grid grid-cols-7 gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <button key={d} onClick={() => setWeekday(d)} className={cn("rounded-lg py-2 text-[10px] font-bold", weekday === d ? "bg-primary text-primary-foreground" : "bg-surface2 text-muted-foreground")}>
                  {dayName(d, lang).slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pb-2.5">
          <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Saat jatuh tempo" : "When due"}</span>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "auto", label: lang === "id" ? "Catat otomatis" : "Auto-post" },
              { value: "confirm", label: lang === "id" ? "Minta konfirmasi" : "Ask first" },
            ]}
          />
        </div>

        <label className="block pb-2.5">
          <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Jatuh tempo pertama (opsional)" : "First due date (optional)"}</span>
          <input
            type="date"
            value={nextDate}
            min={todayStr()}
            onChange={(e) => setNextDate(e.target.value)}
            placeholder={nextOccurrence({ ...emptyRule(), frequency, weekday, dayOfMonth } as never, addDays(todayStr(), -1))}
            className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm outline-none ring-1 ring-border"
          />
        </label>

        <label className="block pb-3">
          <span className="pb-1 block text-[11px] font-bold text-muted-foreground">{lang === "id" ? "Pengingat sebelum jatuh tempo (hari)" : "Remind before due (days)"}</span>
          <select value={remind} onChange={(e) => setRemind(Number(e.target.value))} className="w-full rounded-xl bg-surface2 px-3 py-2.5 text-sm font-semibold outline-none">
            <option value={0}>{lang === "id" ? "Tanpa pengingat" : "No reminder"}</option>
            <option value={1}>H-1 ({lang === "id" ? "default" : "default"})</option>
            <option value={2}>H-2</option>
            <option value={3}>H-3</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-surface2 py-2.5 text-xs font-bold text-muted-foreground">{lang === "id" ? "Batal" : "Cancel"}</button>
          <button
            disabled={!name.trim() || !Number(amount) || !categoryId || !walletId || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await saveRecurringRule({
                  id: edit?.id, name, type, amount: Number(amount), categoryId, walletId,
                  frequency, dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
                  weekday: frequency === "weekly" ? weekday : undefined,
                  mode, remindDaysBefore: remind, nextDate: nextDate || undefined,
                });
                onClose();
              } finally { setSaving(false); }
            }}
            className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-40"
          >
            {saving ? "…" : (lang === "id" ? "Simpan" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function emptyRule(): Partial<RecurringRule> {
  return { name: "", type: "expense", amount: 0, categoryId: "", walletId: "", active: true, mode: "auto", pending: [] };
}
