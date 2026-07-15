-- =============================================================================
-- SkateU — Link spots to their creator's profile
-- Run this in the Supabase SQL Editor AFTER profiles_setup.sql and spots_setup.sql.
-- Safe to re-run: uses IF NOT EXISTS / conditional guards throughout.
--
-- Background: `public.spots.created_by_user_id` and `public.spots.created_at`
-- already exist (see spots_setup.sql). This script adds only what's needed to:
--   1. Embed the creator's public profile (username/avatar) on spot info, and
--   2. Efficiently list every spot a given user created (profile page).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Foreign key: spots.created_by_user_id -> profiles.id
--    `created_by_user_id` already references auth.users, but PostgREST does not
--    expose the `auth` schema, so the client cannot embed the creator that way.
--    Adding a FK to public.profiles lets the client do a single nested select:
--
--      supabase
--        .from('spots')
--        .select('*, creator:profiles(username, avatar_url)')
--
--    profiles.id === auth.users.id (profiles is 1:1 with auth users), so this
--    constraint is always satisfiable. ON DELETE SET NULL mirrors the existing
--    auth.users FK: deleting a user keeps their spots but clears ownership.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'spots_created_by_profile_fkey'
      and conrelid = 'public.spots'::regclass
  ) then
    alter table public.spots
      add constraint spots_created_by_profile_fkey
      foreign key (created_by_user_id)
      references public.profiles (id)
      on delete set null;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Index on created_by_user_id
--    Backs the "show me all spots I created" query on the profile page.
-- -----------------------------------------------------------------------------
create index if not exists spots_created_by_user_id_idx
  on public.spots (created_by_user_id);
