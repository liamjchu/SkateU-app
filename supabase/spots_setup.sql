-- =============================================================================
-- SkateU — Spots table, updated_at trigger, and Row Level Security
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- STORAGE PREREQUISITE (one-time, not part of this SQL):
--   Create a Storage bucket named `spot-images` with PUBLIC READ enabled.
--     * Dashboard → Storage → New bucket → name `spot-images`, "Public bucket" on.
--     * Or via the Storage API:
--         POST {SUPABASE_URL}/storage/v1/bucket
--         Authorization: Bearer <service-role key>
--         { "id": "spot-images", "name": "spot-images", "public": true }
--   Public read lets the client render spot images by URL. Image UPLOADS happen
--   server-side only, using the service-role key (never in client code).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Spots table
--    One row per user-contributed skate spot, linked to a school. City/state
--    live on the referenced school row, not here.
-- -----------------------------------------------------------------------------
create table if not exists public.spots (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools (id) on delete cascade,
  created_by_user_id uuid references auth.users (id) on delete set null,
  name               text not null check (char_length(name) between 1 and 100),
  description        text not null check (char_length(description) between 0 and 1000),
  latitude           double precision not null check (latitude between -90 and 90),
  longitude          double precision not null check (longitude between -180 and 180),
  image_urls         text[] not null default '{}' check (array_length(image_urls, 1) is null or array_length(image_urls, 1) <= 10),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Indexes
--    Fast lookup of spots by school, plus a single composite index over the
--    coordinate pair for geographic queries.
-- -----------------------------------------------------------------------------
create index if not exists spots_school_id_idx
  on public.spots (school_id);

create index if not exists spots_lat_lng_idx
  on public.spots (latitude, longitude);

-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
--    Keep `updated_at` current on every UPDATE. Only the updated row is touched.
-- -----------------------------------------------------------------------------
create or replace function public.set_spots_updated_at()
returns trigger
language plpgsql
security definer            -- runs as the function owner
set search_path = ''        -- hardening: no mutable search_path
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spots_set_updated_at on public.spots;

create trigger spots_set_updated_at
  before update on public.spots
  for each row execute function public.set_spots_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
--    Public read for everyone (including anon); writes are owner-only, keyed on
--    auth.uid(). Server-side inserts use the service-role key (which bypasses
--    RLS) and MUST set created_by_user_id from the verified token — these
--    policies document the intended ownership rules and guard any key-based path.
-- -----------------------------------------------------------------------------
alter table public.spots enable row level security;

-- Policy 1: public read — anyone (including anon) can see spots.
drop policy if exists "Spots are publicly readable" on public.spots;
create policy "Spots are publicly readable"
  on public.spots
  for select
  using (true);

-- Policy 2: a user may insert only rows they own.
drop policy if exists "Users can insert own spots" on public.spots;
create policy "Users can insert own spots"
  on public.spots
  for insert
  with check (auth.uid() = created_by_user_id);

-- Policy 3: a user may update only their own rows.
drop policy if exists "Users can update own spots" on public.spots;
create policy "Users can update own spots"
  on public.spots
  for update
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id);

-- Policy 4: a user may delete only their own rows.
drop policy if exists "Users can delete own spots" on public.spots;
create policy "Users can delete own spots"
  on public.spots
  for delete
  using (auth.uid() = created_by_user_id);
