-- ============================================================
-- BUDGETO v2 — Schema Supabase (GRATIS)
-- Cara pakai:
--   1. Buka https://supabase.com → Sign up (gratis) → New project
--   2. Setelah project jadi, buka menu "SQL Editor" (ikon >_ di sidebar kiri)
--   3. Klik "New query" → copy SEMUA isi file ini → klik "Run"
--   4. Selesai! Tabel siap dipakai aplikasi Budgeto.
-- ============================================================

-- ─── TRANSAKSI ──────────────────────────────────────────────
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null default 0,
  category_id text,
  wallet_id text,
  to_wallet_id text,
  date text not null,
  note text default '',
  created_at bigint,
  updated_at bigint,
  deleted boolean default false
);

-- ─── KATEGORI ───────────────────────────────────────────────
create table if not exists public.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text default 'shapes',
  color text default '#10b981',
  created_at bigint,
  updated_at bigint,
  deleted boolean default false
);

-- ─── DOMPET ─────────────────────────────────────────────────
create table if not exists public.wallets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default 'wallet',
  color text default '#10b981',
  initial_balance numeric default 0,
  created_at bigint,
  updated_at bigint,
  deleted boolean default false
);

-- ─── BUDGET ─────────────────────────────────────────────────
create table if not exists public.budgets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text,
  amount numeric not null default 0,
  created_at bigint,
  updated_at bigint,
  deleted boolean default false
);

-- ─── TARGET TABUNGAN ────────────────────────────────────────
create table if not exists public.goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null default 0,
  current_amount numeric default 0,
  deadline text,
  icon text default 'piggy-bank',
  color text default '#10b981',
  status text default 'active',
  created_at bigint,
  updated_at bigint,
  deleted boolean default false
);

-- ─── PENGATURAN (key-value) ─────────────────────────────────
create table if not exists public.settings (
  key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  value jsonb,
  updated_at bigint,
  primary key (key, user_id)
);

-- ─── RINGKASAN WIDGET (dibaca widget Android) ───────────────
create table if not exists public.widget_summary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0,
  month_income numeric not null default 0,
  month_expense numeric not null default 0,
  widget_token uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Tiap user HANYA bisa melihat & mengubah data miliknya sendiri.
-- ============================================================
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.wallets enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.settings enable row level security;
alter table public.widget_summary enable row level security;

-- Kebijakan umum: pemilik data (login via email OTP)
create policy "tx_owner_all" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cat_owner_all" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallet_owner_all" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budget_owner_all" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goal_owner_all" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "setting_owner_all" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "widget_owner_all" on public.widget_summary for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kebijakan khusus widget: aplikasi widget boleh MEMBACA ringkasan
-- asalkan membawa token rahasia di header x-widget-token
create policy "widget_read_by_token" on public.widget_summary for select using (
  widget_token::text = coalesce(current_setting('request.headers', true)::json->>'x-widget-token', '')
);

-- Selesai! Lanjut: salin Project URL & anon key ke aplikasi Budgeto
-- (Pengaturan → Sinkronisasi Cloud).
