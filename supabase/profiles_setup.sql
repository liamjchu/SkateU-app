-- =============================================================================
-- SkateU — Profiles table, signup trigger, and Row Level Security
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profiles table
--    One public row per auth user. Email lives only in auth.users (private);
--    the public-facing identity is `username`.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Fast, case-insensitive uniqueness/lookup for usernames.
-- (The `unique` above is case-sensitive; this index makes "John" == "john".)
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- -----------------------------------------------------------------------------
-- 2. Signup trigger
--    RECOMMENDED APPROACH: fire AFTER INSERT on auth.users and create the
--    profile row immediately with a NULL username.
--
--    Why NULL-username-in-trigger (vs. inserting from the client):
--      * Works identically for email/password AND Google OAuth — the row
--        always exists the moment the user is created, no client round-trip.
--      * The client only ever needs UPDATE permission (see RLS below), never
--        INSERT, which keeps the security surface smaller.
--      * No race between "session becomes active" and "profile row exists".
--    The onboarding screen then UPDATEs `username` once the user picks one.
--    We also opportunistically pull `avatar_url` from OAuth metadata.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer            -- runs as the function owner so it can write to public.profiles
set search_path = ''        -- hardening: no mutable search_path
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    null,                                              -- username set later, in onboarding
    new.raw_user_meta_data ->> 'avatar_url'            -- present for Google OAuth, else NULL
  )
  on conflict (id) do nothing;                         -- idempotent
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Policy 1: public read — anyone (including anon) can see usernames/avatars.
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles
  for select
  using (true);

-- Policy 2: a user may update only their own row.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: no INSERT policy on purpose. Rows are created by the SECURITY DEFINER
-- trigger above, so clients never insert directly.
