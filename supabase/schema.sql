-- Run this once in your Supabase project's SQL editor.
-- Dashboard → SQL Editor → New query → paste → Run

-- ── Transactions ──────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  type        text        not null check (type in ('income', 'expense')),
  amount      numeric     not null check (amount > 0),
  category    text        not null,
  date        text        not null,          -- YYYY-MM-DD stored as text
  description text        not null default '',
  is_recurring boolean    not null default false,
  created_at  timestamptz not null,
  primary key (user_id, id)
);

alter table public.transactions enable row level security;

create policy "Users manage own transactions"
  on public.transactions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Categories ────────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id       text    not null,
  user_id  uuid    not null references auth.users (id) on delete cascade,
  name     text    not null,
  type     text    not null check (type in ('income', 'expense')),
  is_custom boolean not null default true,
  primary key (user_id, id)
);

alter table public.categories enable row level security;

create policy "Users manage own categories"
  on public.categories for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Enable real-time for transactions ────────────────────────────────────────
-- Required for live sync across browser tabs / devices.
alter publication supabase_realtime add table public.transactions;

-- ── Optional: enable Google OAuth ─────────────────────────────────────────────
-- In Supabase Dashboard → Authentication → Providers → Google
-- add your OAuth Client ID and Secret from Google Cloud Console.
-- Set authorized redirect URI to: https://fmxxubrzhdjzcpjizhwx.supabase.co/auth/v1/callback
