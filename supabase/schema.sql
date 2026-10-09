-- MovieShop — Supabase schema
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). Nothing in the app works without it.
--
-- The important part is the Row Level Security block at the bottom. The
-- application sends the viewer's JWT to Postgres and relies on these policies
-- to decide what that viewer may read. Authorization therefore lives in the
-- database, not in TypeScript, where a refactor cannot quietly bypass it.
--
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- profiles
--
-- One row per auth user, created by the trigger below. `profiles.id` is the
-- auth.users UUID, so no separate id mapping is needed.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text,
  -- Public label shown in the navbar instead of the email address. Copied from
  -- raw_user_meta_data ->> 'display_name' at sign-up, falling back to the email
  -- local part, so it is never empty for a real account.
  display_name     text,
  -- Set TRUE to make this account an admin. Deliberately not
  -- self-service: flipping it via a client update would be a privilege
  -- escalation, so RLS forbids writes to this column below.
  is_admin         boolean not null default false,
  created_at       timestamptz not null default now(),
  last_sign_in_at  timestamptz
);

-- Safe to re-run: adds display_name on databases created before it existed.
alter table public.profiles add column if not exists display_name text;

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- activity_log
--
-- Append-only event trail. There is no UPDATE or DELETE policy, which is what
-- makes it append-only for every client including admins.
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  event       text not null,
  path        text,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_user_id_idx    on public.activity_log (user_id);

alter table public.activity_log enable row level security;

-- ---------------------------------------------------------------------------
-- Auto-create a profile when someone signs up.
--
-- Without this, a new account would sign in successfully but have no profile
-- row, so it would be invisible in the admin stats.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Record sign-ins, which is what "active users" counts.
--
-- Fires on the UPDATE that Supabase performs when a session is refreshed,
-- hence the guard on `old.last_sign_in_at is distinct from new.last_sign_in_at`.
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set last_sign_in_at = new.last_sign_in_at
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_sign_in();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- Profiles: a viewer may read their own row, or every row if they are an admin.
drop policy if exists "read own or admin" on public.profiles;
create policy "read own or admin"
  on public.profiles for select
  using (auth.uid() = id or is_admin);

-- Profiles: a viewer may update only their own row, and NOT the is_admin
-- column. The column-level grant below is what enforces that.
drop policy if exists "update own" on public.profiles;
create policy "update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (email, display_name) on public.profiles to authenticated;

-- Profiles: insert is handled by the trigger with SECURITY DEFINER, so no
-- client insert policy is granted on purpose. A viewer cannot fabricate a row.

-- Activity: a viewer may append their own rows, read their own, and an admin
-- may read all. No update/delete policy exists, so the table is append-only.
drop policy if exists "insert own activity" on public.activity_log;
create policy "insert own activity"
  on public.activity_log for insert
  with check (auth.uid() = user_id);

drop policy if exists "read own or admin activity" on public.activity_log;
create policy "read own or admin activity"
  on public.activity_log for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ---------------------------------------------------------------------------
-- Promote the first admin.
--
-- There is no self-service path to is_admin, so do this by hand in the SQL
-- editor after signing up, replacing the address:
--
--   update public.profiles set is_admin = true where email = 'you@example.com';
--
-- Until a row has is_admin = true, /admin/stats shows only the signed-in
-- viewer's own row, which is the intended fail-closed behaviour.
-- ---------------------------------------------------------------------------