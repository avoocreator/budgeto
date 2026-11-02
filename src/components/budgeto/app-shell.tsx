"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Home, ArrowLeftRight, PieChart, LayoutGrid, Plus, Sun, Moon, Loader2, CloudOff, Cloud, Check, Download, PiggyBank, Target, Wallet as WalletIcon, Tags, Settings2, BarChart3, Repeat, CalendarDays } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, seedIfEmpty } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { useLang, localeOf } from "@/lib/i18n";
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
import { PrivacyToggle } from "./ui-bits";
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

  useEffect(() => {
    if (!hydrated || !onboarded || !notificationsEnabled) return;
    void requestPermission();
  }, [hydrated, onboarded, notificationsEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    scheduleDailyReminder(reminderTime, notificationsEnabled && dailyReminder);
  }, [hydrated, notificationsEnabled, dailyReminder, reminderTime]);

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

  if (!onboarded) return <Onboarding />;
  if (lockEnabled && locked) return <LockScreen />;

  const navItems: { key: TabKey; label: string; icon: typeof Home }[] = [
    { key: "dashboard", label: id ? "Beranda" : "Home", icon: Home },
    { key: "transactions", label: id ? "Transaksi" : "Transactions", icon: ArrowLeftRight },
    { key: "reports", label: id ? "Laporan" : "Reports", icon: PieChart },
    { key: "menu", label: id ? "Menu" : "Menu", icon: LayoutGrid },
  ];

  const viewKey = subView ?? tab;
  const walletCount = wallets?.length ?? 0;
  const current: View = subView ?? tab;
  const isDash = !subView && tab === "dashboard";
  const dateLabel = new Intl.DateTimeFormat(localeOf(lang), { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    useSettings.getState().set("themeMode", next);
  };
  const installApp = installEvent ? () => { void installEvent.prompt(); setInstallEvent(null); } : null;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col lg:max-w-none lg:flex-row">
      {/* Sidebar — hanya desktop */}
      <Sidebar current={current} go={go} id={id} sync={syncInfo} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header HP */}
        <header className="flex items-center justify-between px-5 pb-2 pt-[calc(env(safe-area-inset-top,0px)+14px)] lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-primary-foreground">
              <WalletIcon size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold leading-none tracking-tight">Budgeto</h1>
              <SyncBadge state={syncInfo.state} message={syncInfo.message} id={id} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {installApp && (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-primary" onClick={installApp} aria-label={id ? "Install aplikasi" : "Install app"}>
                <Download size={18} />
              </Button>
            )}
            <PrivacyToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border bg-card text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
              onClick={toggleTheme}
              aria-label={id ? "Ganti tema gelap/terang" : "Toggle dark/light"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
          </div>
        </header>

        {/* Topbar desktop */}
        <header className="hidden items-start justify-between gap-6 px-8 pb-3 pt-7 lg:flex">
          <div className="min-w-0">
            {isDash && (
              <>
                <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{greetingFor(id)}</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {id ? "Pantau dan kendalikan uangmu hari ini." : "Monitor and control your money today."}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-[13px] font-medium">
              <CalendarDays size={15} className="text-muted-foreground" />
              {dateLabel}
            </span>
            {installApp && (
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border bg-card text-primary" onClick={installApp} aria-label={id ? "Install aplikasi" : "Install app"}>
                <Download size={17} />
              </Button>
            )}
            <PrivacyToggle className="h-10 w-10 rounded-xl" />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl border bg-card text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
              onClick={toggleTheme}
              aria-label={id ? "Ganti tema gelap/terang" : "Toggle dark/light"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <button
              onClick={() => openAdd()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-[13px] font-semibold text-background transition-opacity hover:opacity-90 active:opacity-80"
            >
              <Plus size={16} strokeWidth={2.4} />
              {id ? "Catat transaksi" : "Add transaction"}
            </button>
          </div>
        </header>

        {/* Konten — transisi antar view dengan AnimatePresence */}
        <main ref={scrollRef} className="thin-scroll flex-1 overflow-y-auto px-4 pb-32 pt-2 lg:px-8 lg:pb-10 lg:pt-3">
          <div className={cn("mx-auto w-full", isDash ? "lg:max-w-[1200px]" : "lg:max-w-3xl")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={viewKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {subView === "goals" ? <GoalsView onBack={() => setSubView(null)} />
                  : subView === "budgets" ? <BudgetsView onBack={() => setSubView(null)} />
                    : subView === "wallets" ? <WalletsView onBack={() => setSubView(null)} />
                      : subView === "categories" ? <CategoriesView onBack={() => setSubView(null)} />
                        : subView === "bills" ? <BillsView onBack={() => setSubView(null)} />
                          : subView === "settings" ? <SettingsView onBack={() => setSubView(null)} />
                            : tab === "dashboard" ? <DashboardView go={go} onEditTx={openEdit} onAdd={openAdd} />
                              : tab === "transactions" ? <TransactionsView onEditTx={openEdit} />
                                : tab === "reports" ? <ReportsView />
                                  : <MenuView go={go} id={id} onNotification={requestNotification} walletCount={walletCount} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Tombol tambah — HP saja */}
        <button
          onClick={() => openAdd()}
          aria-label={id ? "Tambah transaksi" : "Add transaction"}
          className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+32px)] left-1/2 z-20 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-2xl bg-primary text-primary-foreground ring-4 ring-background transition-transform active:scale-95 lg:hidden"
        >
          <Plus size={24} strokeWidth={2.4} />
        </button>

        {/* Navigasi bawah — HP saja */}
        <nav aria-label="Navigasi utama" className="absolute inset-x-0 bottom-0 z-10 border-t bg-card pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
          <div className="grid grid-cols-5 items-end px-2 pb-2 pt-2">
            {navItems.slice(0, 2).map((item) => (
              <NavBtn key={item.key} item={item} active={tab === item.key && !subView} onClick={() => go(item.key)} />
            ))}
            <span aria-hidden className="h-10" />
            {navItems.slice(2).map((item) => (
              <NavBtn key={item.key} item={item} active={tab === item.key && !subView} onClick={() => go(item.key)} />
            ))}
          </div>
        </nav>
      </div>

      {/* Sheet transaksi */}
      <TransactionSheet state={sheet} onClose={() => setSheet({ open: false })} />
    </div>
  );
}

function greetingFor(id: boolean): string {
  const h = new Date().getHours();
  if (id) return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type SideItem = { view: View; label: string; icon: typeof Home };

function Sidebar({ current, go, id, sync }: { current: View; go: (v: View) => void; id: boolean; sync: { state: string; message: string } }) {
  const groups: { title: string; items: SideItem[] }[] = [
    {
      title: id ? "Menu utama" : "Main menu",
      items: [
        { view: "dashboard", label: id ? "Beranda" : "Home", icon: Home },
        { view: "transactions", label: id ? "Transaksi" : "Transactions", icon: ArrowLeftRight },
        { view: "reports", label: id ? "Laporan" : "Reports", icon: BarChart3 },
      ],
    },
    {
      title: id ? "Fitur" : "Features",
      items: [
        { view: "wallets", label: id ? "Dompet" : "Wallets", icon: WalletIcon },
        { view: "budgets", label: "Budget", icon: Target },
        { view: "bills", label: id ? "Tagihan & rutin" : "Bills & recurring", icon: Repeat },
        { view: "goals", label: id ? "Target tabungan" : "Savings goals", icon: PiggyBank },
        { view: "categories", label: id ? "Kategori" : "Categories", icon: Tags },
      ],
    },
    {
      title: id ? "Umum" : "General",
      items: [{ view: "settings", label: id ? "Pengaturan" : "Settings", icon: Settings2 }],
    },
  ];
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r bg-card px-4 pb-5 pt-6 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-primary-foreground">
          <WalletIcon size={18} strokeWidth={2.2} />
        </div>
        <span className="text-[18px] font-semibold tracking-tight">Budgeto</span>
      </div>

      <nav aria-label="Navigasi utama" className="thin-scroll mt-7 flex-1 space-y-6 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = current === it.view;
                return (
                  <button
                    key={it.view}
                    onClick={() => go(it.view)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] transition-colors",
                      active ? "bg-primary/10 font-semibold text-primary" : "font-medium text-muted-foreground hover:bg-surface2 hover:text-foreground",
                    )}
                  >
                    <it.icon size={18} strokeWidth={active ? 2.3 : 1.9} />
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-2xl bg-surface2 p-3.5">
        <p className="text-[12px] font-semibold">{id ? "Data tersimpan di perangkat" : "Data stays on device"}</p>
        <SyncBadge state={sync.state} message={sync.message} id={id} />
        <button
          onClick={() => go("settings")}
          className="mt-3 h-9 w-full rounded-lg bg-card text-[12px] font-semibold ring-1 ring-border transition-colors hover:bg-background active:opacity-80"
        >
          {id ? "Cadangkan data" : "Back up data"}
        </button>
      </div>
    </aside>
  );
}

function NavBtn({ item, active, onClick }: { item: { key: string; label: string; icon: typeof Home }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center gap-1 rounded-xl py-1 outline-none"
    >
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/12")}>
        <Icon
          size={19}
          strokeWidth={active ? 2.4 : 1.9}
          className={active ? "text-primary" : "text-muted-foreground"}
        />
      </span>
      <span className={cn("text-[10px] leading-none", active ? "font-semibold text-primary" : "font-medium text-muted-foreground")}>
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
    default: icon = <span className="h-1.5 w-1.5 rounded-full bg-income" />; label = id ? "offline · data tersimpan di HP" : "offline · data stays on device";
  }
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] leading-none text-muted-foreground">
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
      <h2 className="px-1 pt-1 text-lg font-semibold tracking-tight">Menu</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it, i) => (
          <button
            key={it.view}
            onClick={() => go(it.view)}
            className={cn("anim-rise group rounded-2xl border bg-card p-3.5 text-left transition-colors hover:bg-surface2 active:bg-surface2", `d${i + 1}`)}
          >
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ backgroundColor: `color-mix(in srgb, ${it.tint} 14%, transparent)`, color: it.tint }}>
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
