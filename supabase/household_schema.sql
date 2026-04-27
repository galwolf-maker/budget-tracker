-- Run this in Supabase Dashboard → SQL Editor → New query → Run
-- Must be run AFTER schema.sql

-- ── 1. Profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text,
  full_name text
);

-- ── 2. Households ─────────────────────────────────────────────────────────────
create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null default 'My Household',
  created_by uuid        not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ── 3. Household members ──────────────────────────────────────────────────────
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ── 4. Invitations ────────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  invited_email  text not null,
  invited_by     uuid not null references auth.users(id),
  token          text not null unique default encode(gen_random_bytes(32), 'hex'),
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '7 days')
);

-- ── 5. Add columns to transactions and categories ─────────────────────────────
alter table public.transactions
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists created_by   uuid references auth.users(id);

alter table public.categories
  add column if not exists household_id uuid references public.households(id) on delete cascade;

-- ── 6. RLS — profiles ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can read profiles in same household"
  on public.profiles for select
  using (
    id = auth.uid() or
    id in (
      select hm.user_id from public.household_members hm
      where hm.household_id in (
        select household_id from public.household_members where user_id = auth.uid()
      )
    )
  );

create policy "Users can upsert their own profile"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── 7. RLS — households ───────────────────────────────────────────────────────
alter table public.households enable row level security;

create policy "Members can view their household"
  on public.households for select
  using (
    id in (select household_id from public.household_members where user_id = auth.uid())
  );

create policy "Authenticated users can create households"
  on public.households for insert
  with check (created_by = auth.uid());

-- ── 8. RLS — household_members ───────────────────────────────────────────────
alter table public.household_members enable row level security;

create policy "Members can view their household members"
  on public.household_members for select
  using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  );

create policy "Users can insert themselves into households"
  on public.household_members for insert
  with check (user_id = auth.uid());

-- ── 9. RLS — invitations ──────────────────────────────────────────────────────
alter table public.invitations enable row level security;

create policy "Household members can manage invitations"
  on public.invitations for all
  using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  )
  with check (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  );

create policy "Anyone can read invitation by token"
  on public.invitations for select
  using (true);

-- ── 10. RLS — transactions (replace old user-scoped policy) ──────────────────
drop policy if exists "Users manage own transactions" on public.transactions;

create policy "Household members can access transactions"
  on public.transactions for all
  using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
    or (household_id is null and user_id = auth.uid())
  )
  with check (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  );

-- ── 11. RLS — categories (replace old user-scoped policy) ────────────────────
drop policy if exists "Users manage own categories" on public.categories;

create policy "Household members can access categories"
  on public.categories for all
  using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
    or (household_id is null and user_id = auth.uid())
  )
  with check (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  );

-- ── 12. Auto-populate profiles on signup ─────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set
    email     = excluded.email,
    full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 13. accept_invitation RPC ─────────────────────────────────────────────────
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_invite    record;
  v_user_id   uuid := auth.uid();
  v_existing  uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select * into v_invite from public.invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'Invitation not found or expired');
  end if;

  select household_id into v_existing
  from public.household_members where user_id = v_user_id limit 1;

  if v_existing is not null then
    return jsonb_build_object('error', 'You are already in a household');
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user_id, 'member')
  on conflict do nothing;

  update public.invitations set status = 'accepted' where id = v_invite.id;

  update public.transactions
  set household_id = v_invite.household_id, created_by = v_user_id
  where user_id = v_user_id and household_id is null;

  update public.categories
  set household_id = v_invite.household_id
  where user_id = v_user_id and household_id is null;

  return jsonb_build_object('household_id', v_invite.household_id::text);
end;
$$;
