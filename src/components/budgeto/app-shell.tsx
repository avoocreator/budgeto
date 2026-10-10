// ============================================================
// BUDGETO v3 — App Shell: navigasi bawah, FAB, gate, deep link
// - Gate: onboarding → lock (F07) → app
// - Deep link widget/shortcut (F04): /?action=add&type=... dan
//   budgeto://add?type=... (Capacitor appUrlOpen via runtime check)
// - Snapshot widget diperbarui saat app dibuka, data berubah, dan
//   pergantian hari (interval tengah malam) (F04)
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Home, ArrowLeftRight, PieChart, LayoutGrid, Plus, Sun, Moon, Loader2, CloudOff, Cloud, Check, Download, PiggyBank, Target, Wallet as WalletIcon, Tags, Settings2, BarChart3, Repeat } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, seedIfEmpty } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { useLang } from "@/lib/i18n";
import { initSync, getSyncState, onSyncChange } from "@/lib/sync";
import { ensureSw, scheduleDailyReminder, requestPermission, notify } from "@/lib/notifications";
import { processDueRules, rulesDueWithin } from "@/lib/recurring";
import { pushWidgetSnapshot } from "@/lib/widget";
import { installLockWatch, useLock } from "@/lib/lock";
import { DashboardView } from "./dashboard-view";
import { TransactionsView } from "./transactions-view";
import { ReportsView } from "./reports-view";
import { SettingsView } from "./settings-view";
import { GoalsView, BudgetsView, WalletsView, CategoriesView } from "./managers";
import { BillsView } from "./bills-view";
import { TransactionSheet, type TxSheetState } from "./tx-sheet";
import { Onboarding } from "./onboarding";
import { LockScreen } from "./lock-screen";
import type { View } from "./types";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TabKey = "dashboard" | "transactions" | "reports" | "menu";

const emptySubscribe = () => () => {};
/** true setelah hydration — tanpa setState di effect (aman utk React Compiler lint). */
function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function AppShell() {
  const { theme, setTheme } = useTheme();
  const lang = useLang((s) => s.lang);
  const id = lang === "id";
  const onboarded = useSettings((s) => s.onboarded);
  const lockEnabled = useSettings((s) => s.lockEnabled);
  const locked = useLock((s) => s.locked);
  
  const hydrated = useHydrated();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [subView, setSubView] = useState<View | null>(null);
  const [sheet, setSheet] = useState<TxSheetState>({ open: false });
  const [syncInfo, setSyncInfo] = useState(getSyncState());
  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const dailyReminder = useSettings((s) => s.dailyReminder);
  const reminderTime = useSettings((s) => s.reminderTime);
  const billReminders = useSettings((s) => s.billReminders);

  const rules = useLiveQuery(() => db.recurringRules.toArray(), []);
  const wallets = useLiveQuery(() => db.wallets.filter((w) => !w.deleted).toArray(), []);

  // ── Init sekali: seed, SW, sync, lock, deep link, widget ──
  useEffect(() => {
    void seedIfEmpty();
    void ensureSw();
    initSync();
    const unLock = installLockWatch();
    const unSync = onSyncChange((state, message) => setSyncInfo({ state, message: message ?? "" }));

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // ── Deep link PWA: /?action=add&type=expense|income ──
    // (setState sengaja dipanggil sekali setelah mount untuk menangkap
    //  deep link widget/shortcut — aman dan tidak bisa di-lazy-init.)
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add") {
      const t = params.get("type");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSheet({ open: true, prefillType: t === "income" ? "income" : "expense" });
      window.history.replaceState({}, "", "/");
    } else if (params.get("view")) {
      const v = params.get("view");
      if (v === "reports") setTab("reports");
      else if (v === "transactions") setTab("transactions");
      else if (v === "bills") setSubView("bills");
      else if (v === "settings") setSubView("settings");
      window.history.replaceState({}, "", "/");
    }

    // ── Deep link APK: budgeto://add?type=... (plugin App tersedia saat runtime di Capacitor) ──
    const cap = (window as unknown as { Capacitor?: { Plugins?: { App?: { addListener: (ev: string, cb: (d: { url: string }) => void) => void } } } }).Capacitor;
    const appPlugin = cap?.Plugins?.App;
    if (appPlugin?.addListener) {
      try {
        appPlugin.addListener("appUrlOpen", (data: { url: string }) => {
          try {
            const url = new URL(data.url);
            if (url.host === "add" || url.pathname.includes("add")) {
              const t = url.searchParams.get("type");
              setSheet({ open: true, prefillType: t === "income" ? "income" : "expense" });
            }
          } catch { /* URL tidak valid — abaikan */ }
        });
      } catch { /* plugin tidak siap — abaikan */ }
    }

    return () => {
      unLock();
      unSync();
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  // ── Proses tagihan jatuh tempo + pengingat H-1 + snapshot saat app dibuka ──
  useEffect(() => {
    if (!hydrated || !onboarded) return;
    (async () => {
      const res = await processDueRules();
      if (res.posted > 0) {
        toast.success(id ? `${res.posted} tagihan otomatis tercatat` : `${res.posted} bills auto-posted`);
      }
      if (billReminders && (rules ?? []).length > 0) {
        const due = rulesDueWithin(rules ?? [], 1);
        for (const r of due) {
          void notify(
            id ? "Pengingat tagihan" : "Bill reminder",
            id ? `"${r.name}" jatuh tempo besok (${r.amount.toLocaleString("id-ID")})` : `"${r.name}" is due tomorrow`,
            "alarm-clock"
          );
        }
      }
      void pushWidgetSnapshot();
    })();
  }, [hydrated, onboarded]);

  // ── Pembaruan widget saat pergantian hari (interval menit; murah) ──
  useEffect(() => {
    if (!hydrated || !onboarded) return;
    const today = new Date().toISOString().slice(0, 10);
    const timer = setInterval(() => {
      const now = new Date().toISOString().slice(0, 10);
      if (now !== today) {
        void processDueRules();
        void pushWidgetSnapshot();
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [hydrated, onboarded]);

  // Pengingat harian
  useEffect(() => {
    if (!hydrated || !notificationsEnabled) return;
    scheduleDailyReminder(reminderTime, dailyReminder);
  }, [hydrated, notificationsEnabled, dailyReminder, reminderTime]);

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

  const requestNotification = useCallback(() => {
    void requestPermission();
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  // ── GATE 1: onboarding ──
  if (!onboarded) return <Onboarding />;
  // ── GATE 2: kunci app (F07) — isi app tidak dirender ──
  if (lockEnabled && locked) return <LockScreen />;

  const navItems: { key: TabKey; label: string; icon: typeof Home }[] = [
    { key: "dashboard", label: id ? "Beranda" : "Home", icon: Home },
    { key: "transactions", label: id ? "Transaksi" : "Transactions", icon: ArrowLeftRight },
    { key: "reports", label: id ? "Laporan" : "Reports", icon: PieChart },
    { key: "menu", label: id ? "Menu" : "Menu", icon: LayoutGrid },
  ];

  const viewKey = subView ?? tab;
  const walletCount = wallets?.length ?? 0;

  return (
    <div className="relative mx-auto flex h-dvh max-w-md flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pb-1 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
        <div className="anim-rise flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-primary text-[15px] font-black text-primary-foreground shadow-md">
            B
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn ring-2 ring-background" />
          </div>
          <div>
            <h1 className="text-[16px] font-extrabold leading-none tracking-tight">Budgeto</h1>
            <SyncBadge state={syncInfo.state} message={syncInfo.message} id={id} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {installEvent && (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-primary" onClick={() => { void installEvent.prompt(); setInstallEvent(null); }} aria-label={id ? "Install aplikasi" : "Install app"}>
              <Download size={18} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl bg-card/60 shadow-sm ring-1 ring-border/60 backdrop-blur transition-colors hover:bg-accent"
            onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); useSettings.getState().set("themeMode", next); }}
            aria-label={id ? "Ganti tema gelap/terang" : "Toggle dark/light"}
          >
            {theme === "dark" ? <Sun size={17} className="text-warn" /> : <Moon size={17} className="text-muted-foreground" />}
          </Button>
        </div>
      </header>

      {/* Konten */}
      <main ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-4 pb-28 pt-2">
        <div key={viewKey} className="anim-rise">
          {subView === "goals" ? <GoalsView onBack={() => setSubView(null)} />
            : subView === "budgets" ? <BudgetsView onBack={() => setSubView(null)} />
              : subView === "wallets" ? <WalletsView onBack={() => setSubView(null)} />
                : subView === "categories" ? <CategoriesView onBack={() => setSubView(null)} />
                  : subView === "bills" ? <BillsView onBack={() => setSubView(null)} />
                    : subView === "settings" ? <SettingsView onBack={() => setSubView(null)} />
                      : tab === "dashboard" ? <DashboardView go={go} onEditTx={openEdit} />
                        : tab === "transactions" ? <TransactionsView onEditTx={openEdit} />
                          : tab === "reports" ? <ReportsView />
                            : <MenuView go={go} id={id} onNotification={requestNotification} walletCount={walletCount} />}
        </div>
      </main>

      {/* FAB */}
      <div className="absolute bottom-[74px] left-1/2 z-20 -translate-x-1/2">
        <span aria-hidden className="absolute inset-0 -m-1.5 rounded-[22px] bg-primary/40 blur-md" />
        <button
          onClick={() => openAdd()}
          aria-label={id ? "Tambah transaksi" : "Add transaction"}
          className="fab-pop relative flex h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-xl ring-1 ring-white/25 transition-transform duration-200 active:scale-90"
        >
          <Plus size={26} strokeWidth={2.6} className="drop-shadow" />
        </button>
      </div>

      {/* Navigasi bawah */}
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

function SyncBadge({ state, message, id }: { state: string; message: string; id: boolean }) {
  let icon: React.ReactNode;
  let label: string;
  switch (state) {
    case "syncing": icon = <Loader2 size={9} className="animate-spin" />; label = message || (id ? "sinkron…" : "syncing…"); break;
    case "ok": icon = <Check size={9} className="text-income" />; label = id ? "tersinkron" : "synced"; break;
    case "error": icon = <CloudOff size={9} className="text-expense" />; label = id ? "sinkron gagal" : "sync failed"; break;
    case "offline": icon = <CloudOff size={9} />; label = id ? "offline" : "offline"; break;
    case "idle": icon = <Cloud size={9} />; label = id ? "belum login cloud" : "not signed in"; break;
    default: icon = <span className="h-1.5 w-1.5 rounded-full bg-income" />; label = id ? "mode offline — data aman di HP" : "offline mode — data stays on device";
  }
  return (
    <p className="mt-0.5 flex items-center gap-1 text-[9px] leading-none text-muted-foreground">
      {icon} {label}
    </p>
  );
}

function MenuView({ go, id, onNotification, walletCount }: { go: (v: View) => void; id: boolean; onNotification: () => void; walletCount: number }) {
  void onNotification;
  void walletCount;
  const items: { view: View; icon: typeof PiggyBank; title: string; desc: string; tint: string }[] = [
    { view: "budgets", icon: Target, title: id ? "Budget" : "Budgets", desc: id ? "Batas belanja per kategori" : "Per-category limits", tint: "var(--status-warn)" },
    { view: "bills", icon: Repeat, title: id ? "Tagihan & Rutinitas" : "Bills & Recurring", desc: id ? "Aturan berulang otomatis" : "Auto-posted recurring rules", tint: "var(--status-bad)" },
    { view: "goals", icon: PiggyBank, title: id ? "Target Tabungan" : "Savings Goals", desc: id ? "Nabung untuk tujuan tertentu" : "Save toward goals", tint: "var(--status-ok)" },
    { view: "wallets", icon: WalletIcon, title: id ? "Dompet & Akun" : "Wallets", desc: id ? "Tunai, bank, e-wallet" : "Cash, bank, e-wallet", tint: "var(--income)" },
    { view: "categories", icon: Tags, title: id ? "Kategori" : "Categories", desc: id ? "Kelola jenis pemasukan & pengeluaran" : "Manage income & expense types", tint: "var(--expense)" },
    { view: "reports", icon: BarChart3, title: id ? "Laporan Lengkap" : "Full Reports", desc: id ? "Grafik, tren, dan insight" : "Charts, trends, insights", tint: "var(--primary)" },
    { view: "settings", icon: Settings2, title: id ? "Pengaturan" : "Settings", desc: id ? "Tema, periode, keamanan, backup" : "Theme, period, security, backup", tint: "var(--text-muted)" },
  ];
  return (
    <div className="space-y-3">
      <h2 className="px-1 pt-1 text-lg font-extrabold tracking-tight">{id ? "Menu" : "Menu"}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it, i) => (
          <button
            key={it.view}
            onClick={() => go(it.view)}
            className={cn("anim-rise group rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]", `d${i + 1}`)}
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: `color-mix(in srgb, ${it.tint} 14%, transparent)`, color: it.tint }}>
              <it.icon size={17} strokeWidth={2.2} />
            </div>
            <p className="text-[13px] font-bold leading-tight">{it.title}</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{it.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
