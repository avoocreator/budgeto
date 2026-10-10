// ============================================================
// BUDGETO v3 — Registry ikon lucide (nama di DB → komponen)
// ============================================================

import {
  Utensils, Car, ShoppingBag, Clapperboard, HeartPulse, Zap, Coffee, ShoppingCart,
  GraduationCap, House, Shapes, Wallet, Laptop, TrendingUp, Gift, Sparkles, Banknote,
  Smartphone, Landmark, PiggyBank, CreditCard, Bus, Gamepad2, Shirt, Music, Baby, PawPrint,
  Dumbbell, Plane, BookOpen, Briefcase, Wrench, Stethoscope, Wifi, Droplets, Popcorn,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils, car: Car, "shopping-bag": ShoppingBag, clapperboard: Clapperboard,
  "heart-pulse": HeartPulse, zap: Zap, coffee: Coffee, "shopping-cart": ShoppingCart,
  "graduation-cap": GraduationCap, house: House, shapes: Shapes, wallet: Wallet,
  laptop: Laptop, "trending-up": TrendingUp, gift: Gift, sparkles: Sparkles,
  banknote: Banknote, smartphone: Smartphone, landmark: Landmark, "piggy-bank": PiggyBank,
  "credit-card": CreditCard, bus: Bus, "gamepad-2": Gamepad2, shirt: Shirt, music: Music,
  baby: Baby, "paw-print": PawPrint, dumbbell: Dumbbell, plane: Plane, "book-open": BookOpen,
  briefcase: Briefcase, wrench: Wrench, stethoscope: Stethoscope, wifi: Wifi,
  droplets: Droplets, popcorn: Popcorn, trending: TrendingUp,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export function Icon({ name, ...props }: { name: string } & React.ComponentProps<LucideIcon>) {
  const Cmp = ICON_MAP[name] ?? Shapes;
  return <Cmp {...props} />;
}
