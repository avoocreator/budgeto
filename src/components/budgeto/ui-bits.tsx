// ============================================================
// BUDGETO v2 — Komponen UI bersama (compact minimalist)
// ============================================================

"use client";

import {
  Wallet, Landmark, Banknote, CreditCard, Coins, PiggyBank, Utensils, Coffee,
  Car, Bus, Fuel, ShoppingBag, ShoppingCart, Clapperboard, Gamepad2, Music,
  HeartPulse, Pill, Zap, Droplets, Wifi, Smartphone, GraduationCap, BookOpen,
  Gift, Sparkles, TrendingUp, TrendingDown, Laptop, Briefcase, Home, Plane,
  Shirt, Baby, PawPrint, Dumbbell, Scissors, Wrench, Shapes, CircleHelp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

// Kurasi ikon (bundle tetap ramping)
export const ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet, landmark: Landmark, banknote: Banknote, "credit-card": CreditCard,
  coins: Coins, "piggy-bank": PiggyBank, utensils: Utensils, coffee: Coffee,
  car: Car, bus: Bus, fuel: Fuel, "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart, clapperboard: Clapperboard, gamepad: Gamepad2, music: Music,
  "heart-pulse": HeartPulse, pill: Pill, zap: Zap, droplets: Droplets,
  wifi: Wifi, smartphone: Smartphone, "graduation-cap": GraduationCap, book: BookOpen,
  gift: Gift, sparkles: Sparkles, "trending-up": TrendingUp, "trending-down": TrendingDown,
  laptop: Laptop, briefcase: Briefcase, home: Home, plane: Plane,
  shirt: Shirt, baby: Baby, paw: PawPrint, dumbbell: Dumbbell,
  scissors: Scissors, wrench: Wrench, shapes: Shapes, help: CircleHelp,
};

export const ICON_CHOICES = Object.keys(ICON_MAP);

export function CatIcon({ name, color, size = 16, className }: { name: string; color?: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Shapes;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", className)}
      style={{ width: size + 10, height: size + 10, backgroundColor: `${color ?? "#64748b"}1f` }}
    >
      <Icon size={size} style={{ color: color ?? "#64748b" }} strokeWidth={2.2} />
    </span>
  );
}

// ─── Header section ──────────────────────────────────────────
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}

// ─── Kartu dasar ─────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("card-soft rounded-2xl p-3", className)}>{children}</div>
  );
}

export function EmptyState({ icon: Icon = Shapes, title, subtitle }: { icon?: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/50 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
        <Icon size={22} className="text-primary/70" />
      </span>
      <p className="text-sm font-semibold text-foreground/75">{title}</p>
      {subtitle && <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────
export function ProgressBar({ percent, color, className }: { percent: number; color?: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const base = color ?? (percent >= 100 ? "var(--expense)" : "var(--primary)");
  return (
    <div className={cn("h-[7px] w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${clamped}%`,
          background: `linear-gradient(90deg, color-mix(in oklab, ${base} 70%, transparent), ${base})`,
        }}
      />
    </div>
  );
}

// ─── Jumlah uang ─────────────────────────────────────────────
export function Amount({ value, currency, type, className, compact }: {
  value: number;
  currency: string;
  type?: "income" | "expense";
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("tnum font-semibold", type === "income" && "text-income", type === "expense" && "text-expense", className)}>
      {formatMoney(value, currency, { compact })}
    </span>
  );
}
