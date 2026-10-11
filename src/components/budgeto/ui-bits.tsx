// ============================================================
// BUDGETO v3.1 — Komponen kecil bersama
// MoneyText (mode privasi F07), AnimatedMoney (count-up), Segmented
// dengan indikator meluncur (framer-motion), EmptyState, Card, dsb.
// ============================================================

"use client";

import { useEffect, useId } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { Eye, EyeOff } from "lucide-react";
import { Icon } from "./icons";

/** Tampilkan nominal; otomatis •••• bila mode privasi aktif (F07). */
export function MoneyText({
  amount, className, compact = false, signed = false, colorize = false, forceHide = false,
}: {
  amount: number; className?: string; compact?: boolean; signed?: boolean; colorize?: boolean; forceHide?: boolean;
}) {
  const lang = useLang((s) => s.lang);
  const privacy = useSettings((s) => s.privacyMode);
  if (privacy || forceHide) {
    return <span className={cn("big-number tracking-widest", className)}>••••</span>;
  }
  return (
    <span className={cn("big-number", colorize && (amount > 0 ? "text-income" : amount < 0 ? "text-expense" : ""), className)}>
      {formatMoney(amount, lang, { compact, signed })}
    </span>
  );
}

/** Nominal dengan animasi count-up halus saat nilai berubah (F01).
 *  Memakai MotionValue → DOM diperbarui imperatif tanpa re-render React. */
export function AnimatedMoney({
  amount, className, compact = false, duration = 0.55,
}: {
  amount: number; className?: string; compact?: boolean; duration?: number;
}) {
  const lang = useLang((s) => s.lang);
  const privacy = useSettings((s) => s.privacyMode);
  const mv = useMotionValue(amount);
  const text = useTransform(mv, (v) => formatMoney(v, lang, { compact }));

  useEffect(() => {
    if (privacy) { mv.set(amount); return; }
    const controls = animate(mv, amount, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [amount, privacy, duration, mv]);

  if (privacy) {
    return <span className={cn("big-number tracking-widest", className)}>••••</span>;
  }
  return <motion.span className={cn("big-number", className)}>{text}</motion.span>;
}

/** Toggle cepat sembunyikan angka (alur I). */
export function PrivacyToggle({ className }: { className?: string }) {
  const privacy = useSettings((s) => s.privacyMode);
  const set = useSettings((s) => s.set);
  return (
    <button
      onClick={() => set("privacyMode", !privacy)}
      aria-label={privacy ? "Tampilkan angka" : "Sembunyikan angka"}
      className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-surface2 text-muted-foreground ring-1 ring-border/60 transition-colors hover:text-foreground active:scale-90", className)}
    >
      {privacy ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

export function IconBubble({ name, color, size = 36, className }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, backgroundColor: `${color}22`, color }}
    >
      <Icon name={name} size={Math.round(size * 0.5)} strokeWidth={2.1} />
    </span>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1.5">
      <h2 className="text-[13px] font-bold text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon?: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card/50 px-6 py-8 text-center">
      {icon && <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface2 text-muted-foreground">{icon}</div>}
      <p className="text-sm font-bold">{title}</p>
      {desc && <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border bg-card shadow-sm", className)}>{children}</div>;
}

/** Segmented control dengan pill aktif yang MELUNCUR halus antar opsi. */
export function Segmented<T extends string>({
  value, options, onChange, className,
}: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string;
}) {
  const groupId = useId();
  return (
    <div className={cn("grid gap-1 rounded-xl bg-surface2 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className="relative rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
                transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
              />
            )}
            <span className={cn("relative z-10 transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Progress bar tipis warna sesuai persen (budget/widget) + animasi lebar. */
export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const color = percent >= 100 ? "bg-bad" : percent >= 80 ? "bg-warn" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface2", className)}>
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </div>
  );
}
