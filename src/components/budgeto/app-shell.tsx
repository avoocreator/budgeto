// ============================================================
// BUDGETO v2 — App Shell: navigasi bawah, FAB, routing view
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Home, ArrowLeftRight, PieChart, LayoutGrid, Plus, Sun, Moon, Loader2, CloudOff, Cloud, Check, Download, Sparkles } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, seedIfEmpty } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { initSync, getSyncState, onSyncChange } from "@/lib/sync";
import { ensureSw, scheduleDailyReminder, registerPeriodicSync } from "@/lib/notifications";
import { DashboardView } from "./dashboard-view";
import { TransactionsView } from "./transactions-view";
import { ReportsView } from "./reports-view";
import { SettingsView } from "./settings-view";
import { GoalsView, BudgetsView, WalletsView, CategoriesView } from "./managers";
import { TransactionSheet, type TxSheetState } from "./transaction-sheet";
import type { View } from "./types";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useHydrated } from "./use-hydrated";

type TabKey = "dashboard" | "transactions" | "reports" | "menu";

export function AppShell() {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [subView, setSubView] = useState<View | null>(null);
  const [sheet, setSheet] = useState<TxSheetState>({ open: false });
  const [syncInfo, setSyncInfo] = useState(getSyncState());
  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const dailyReminder = useSettings((s) => s.dailyReminder);
  const reminderTime = useSettings((s) => s.reminderTime);

  // ── Init: seed, SW, sync, deep link ──
  useEffect(() => {
    void seedIfEmpty();
    void ensureSw();
    initSync();

    const un = onSyncChange((state, message) => setSyncInfo({ state, message }));

    // PWA install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Deep link: /?action=add&type=expense  (dari widget/shortcut)
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add") {
      const t = params.get("type");
      setSheet({ open: true, prefillType: t === "income" ? "income" : t === "transfer" ? "transfer" : "expense" });
      window.history.replaceState({}, "", "/");
    } else if (params.get("view")) {
      const v = params.get("view");
      if (v === "reports") setTab("reports");
      else if (v === "transactions") setTab("transactions");
      window.history.replaceState({}, "", "/");
    }

    // Capacitor (APK): tangkap budgeto:// deep link
    (async () => {
      try {
        if (typeof window !== "undefined" && (window as { Capacitor?: unknown }).Capacitor) {
          const { App: CapApp } = await import("@capacitor/app");
          CapApp.addListener("appUrlOpen", (data: { url: string }) => {
            const url = new URL(data.url);
            if (url.host === "add" || url.pathname.includes("add")) {
              const t = url.searchParams.get("type");
              setSheet({ open: true, prefillType: t === "income" ? "income" : "expense" });
            }
          });
        }
      } catch { /* bukan APK — abaikan */ }
    })();

    return () => {
      un();
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  // Pengingat harian
  useEffect(() => {
    if (!mounted || !notificationsEnabled) return;
    scheduleDailyReminder(reminderTime, dailyReminder);
    void registerPeriodicSync();
  }, [mounted, notificationsEnabled, dailyReminder, reminderTime]);

  // Scroll ke atas saat ganti view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab, subView]);

  const go = useCallback((v: View) => {
    if (["dashboard", "transactions", "reports", "menu"].includes(v)) {
      setTab(v as TabKey);
      setSubView(null);
    } else {
      setSubView(v);
    }
  }, []);

  const openAdd = useCallback((prefillType?: "expense" | "income" | "transfer") => {
    setSheet({ open: true, prefillType: prefillType ?? "expense" });
  }, []);

  const openEdit = useCallback((tx: Transaction) => {
    setSheet({ open: true, edit: tx });
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const navItems: { key: TabKey; label: string; icon: typeof Home }[] = [
    { key: "dashboard", label: "Beranda", icon: Home },
    { key: "transactions", label: "Transaksi", icon: ArrowLeftRight },
    { key: "reports", label: "Laporan", icon: PieChart },
    { key: "menu", label: "Menu", icon: LayoutGrid },
  ];

  const viewKey = subView ?? tab;

  return (
    <div className="relative mx-auto flex h-dvh max-w-md flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pb-1 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
        <div className="anim-rise flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 text-[15px] font-black text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/30">
            B
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-background" />
          </div>
          <div>
            <h1 className="text-[16px] font-extrabold leading-none tracking-tight">Budgeto</h1>
            <SyncBadge state={syncInfo.state} message={syncInfo.message} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {installEvent && (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-primary" onClick={() => { void installEvent.prompt(); setInstallEvent(null); }} aria-label="Install aplikasi">
              <Download size={18} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl bg-card/60 shadow-sm ring-1 ring-border/60 backdrop-blur transition-colors hover:bg-accent"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Ganti tema gelap/terang"
          >
            {theme === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-600" />}
          </Button>
        </div>
      </header>

      {/* Konten — transisi halus tiap ganti halaman */}
      <main ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-4 pb-28 pt-2">
        <div key={viewKey} className="anim-rise">
          {subView === "goals" ? <GoalsView onBack={() => setSubView(null)} />
            : subView === "budgets" ? <BudgetsView onBack={() => setSubView(null)} />
              : subView === "wallets" ? <WalletsView onBack={() => setSubView(null)} />
                : subView === "categories" ? <CategoriesView onBack={() => setSubView(null)} />
                  : subView === "settings" ? <SettingsView onBack={() => setSubView(null)} />
                    : tab === "dashboard" ? <DashboardView go={go} onEditTx={openEdit} />
                      : tab === "transactions" ? <TransactionsView onEditTx={openEdit} />
                        : tab === "reports" ? <ReportsView />
                          : <MenuView go={go} />}
        </div>
      </main>

      {/* FAB dengan cincin glow */}
      <div className="absolute bottom-[74px] left-1/2 z-20 -translate-x-1/2">
        <span aria-hidden className="fab-glow absolute inset-0 -m-1.5 rounded-[22px] bg-gradient-to-br from-emerald-500 to-teal-400 blur-md" />
        <button
          onClick={() => openAdd()}
          aria-label="Tambah transaksi"
          className="fab-pop relative flex h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-600/35 ring-1 ring-white/25 transition-transform duration-200 active:scale-90"
        >
          <Plus size={26} strokeWidth={2.6} className="drop-shadow" />
        </button>
      </div>

      {/* Navigasi bawah melayang (glass) */}
      <nav aria-label="Navigasi utama" className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-md px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
          <div className="pointer-events-auto grid grid-cols-5 items-end rounded-[22px] border bg-card/85 px-2 pb-1.5 pt-2 shadow-lg shadow-black/10 backdrop-blur-xl dark:shadow-black/40">
            {navItems.slice(0, 2).map((item) => (
              <NavBtn key={item.key} item={item} active={tab === item.key && !subView} onClick={() => go(item.key)} />
            ))}
            <span aria-hidden className="h-10" />
            {navItems.slice(2).map((item) => (
              <NavBtn key={item.key} item={item} active={tab === item.key && !subView} onClick={() => go(item.key)} />
            ))}
          </div>
        </div>
      </nav>

      {/* Sheet transaksi */}
      <TransactionSheet state={sheet} onClose={() => setSheet({ open: false })} />
    </div>
  );
}

function NavBtn({ item, active, onClick }: { item: { key: string; label: string; icon: typeof Home }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="group flex flex-col items-center gap-1 rounded-xl py-1 outline-none"
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300",
          active ? "bg-primary/15" : "bg-transparent group-active:bg-muted"
        )}
      >
        <Icon
          size={19}
          strokeWidth={active ? 2.5 : 1.9}
          className={cn("transition-all duration-300", active ? "scale-110 text-primary" : "text-muted-foreground group-hover:text-foreground/70")}
        />
      </span>
      <span className={cn("text-[9.5px] leading-none transition-colors", active ? "font-bold text-primary" : "font-medium text-muted-foreground")}>
        {item.label}
      </span>
    </button>
  );
}

function SyncBadge({ state, message }: { state: string; message: string }) {
  const title = useLiveQuery(async () => {
    const s = await db.settings.get("syncTitle");
    return s?.value as string | undefined;
  }, []);
  void title;

  let icon: React.ReactNode;
  let label: string;
  switch (state) {
    case "syncing": icon = <Loader2 size={9} className="animate-spin" />; label = message || "sinkron..."; break;
    case "ok": icon = <Check size={9} className="text-income" />; label = "tersinkron"; break;
    case "error": icon = <CloudOff size={9} className="text-expense" />; label = "sinkron gagal"; break;
    case "offline": icon = <CloudOff size={9} />; label = "offline"; break;
    case "idle": icon = <Cloud size={9} />; label = "belum login cloud"; break;
    default: icon = <span className="h-1.5 w-1.5 rounded-full bg-income" />; label = "mode offline — data aman di HP";
  }
  return (
    <p className="mt-0.5 flex items-center gap-1 text-[9px] leading-none text-muted-foreground">
      {icon} {label}
    </p>
  );
}

import { PiggyBank, Target, Wallet as WalletIcon, Tags, Settings2, ChevronRight, BarChart3 } from "lucide-react";
function MenuView({ go }: { go: (v: View) => void }) {
  const items: { view: View; icon: typeof PiggyBank; title: string; desc: string; tint: string }[] = [
    { view: "goals", icon: PiggyBank, title: "Target Tabungan", desc: "Nabung untuk tujuan tertentu", tint: "oklch(0.65 0.14 300)" },
    { view: "budgets", icon: Target, title: "Budget Bulanan", desc: "Batas belanja per kategori", tint: "oklch(0.65 0.15 55)" },
    { view: "wallets", icon: WalletIcon, title: "Dompet & Akun", desc: "Tunai, bank, e-wallet", tint: "oklch(0.65 0.14 200)" },
    { view: "categories", icon: Tags, title: "Kategori", desc: "Kelola jenis pemasukan & pengeluaran", tint: "oklch(0.65 0.14 145)" },
    { view: "reports", icon: BarChart3, title: "Laporan Lengkap", desc: "Grafik, tren, dan insight", tint: "oklch(0.65 0.15 25)" },
    { view: "settings", icon: Settings2, title: "Pengaturan", desc: "Tema, notifikasi, cloud, backup", tint: "oklch(0.6 0.02 240)" },
  ];
  return (
    <div className="space-y-3">
      <h2 className="px-1 pt-1 text-lg font-extrabold tracking-tight">Menu</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it, i) => (
          <button
            key={it.view}
            onClick={() => go(it.view)}
            className={cn("anim-rise group rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]", `d${i + 1}`)}
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: `${it.tint}22` }}>
              <it.icon size={17} style={{ color: it.tint }} strokeWidth={2.2} />
            </div>
            <p className="text-[13px] font-bold leading-tight">{it.title}</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{it.desc}</p>
          </button>
        ))}
      </div>
      <div className="anim-rise d6 relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-accent/40 to-transparent p-3.5">
        <div className="absolute -right-4 -top-6 h-20 w-20 rounded-full bg-primary/10 blur-xl" />
        <div className="relative flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles size={14} className="text-primary" />
          </span>
          <div>
            <p className="text-xs font-bold">Tips cepat</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Tekan lama ikon Budgeto di layar utama HP untuk shortcut cepat: langsung catat pengeluaran, pemasukan, atau buka laporan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


