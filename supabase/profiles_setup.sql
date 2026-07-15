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

-- Keep profile timestamps current for both client and server updates.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

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

-- Backfill profiles for users created before the signup trigger existed.
-- This is idempotent and runs before the spots -> profiles FK is added.
insert into public.profiles (id, username, avatar_url)
select
  users.id,
  null,
  users.raw_user_meta_data ->> 'avatar_url'
from auth.users as users
on conflict (id) do nothing;

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

-- Username changes are performed by the moderated server flow. Direct client
-- updates may still change permitted profile fields, but cannot change the
-- username column.
create or replace function public.profile_username_is_unchanged(
  profile_id uuid,
  candidate_username text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select existing.username is not distinct from candidate_username
  from public.profiles as existing
  where existing.id = profile_id;
$$;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_username_is_unchanged(id, username)
  );

-- Note: no INSERT policy on purpose. Rows are created by the SECURITY DEFINER
-- trigger above, so clients never insert directly.
