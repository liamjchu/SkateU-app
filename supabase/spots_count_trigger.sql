-- =============================================================================
-- SkateU — Keep schools.numspots in sync with the spots table
-- Run this in the Supabase SQL Editor AFTER spots_setup.sql.
-- Safe to re-run: uses CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- Background: `public.schools.numspots` is the value the app shows as a school's
-- spot counter. It is NOT updated automatically when a spot is added or removed,
-- so the counter never changes. This script:
--   1. Adds a trigger that increments/decrements numspots on spot insert/delete
--      (and moves the count when a spot's school_id changes), and
--   2. Backfills numspots for every school to match the real number of spots.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trigger function
--    Adjusts the owning school's numspots for each spot write. Uses greatest()
--    on delete so the count can never go negative.
-- -----------------------------------------------------------------------------
create or replace function public.sync_school_numspots()
returns trigger
language plpgsql
security definer            -- runs as the function owner (bypasses RLS)
set search_path = ''        -- hardening: no mutable search_path
as $$
begin
  if (tg_op = 'INSERT') then
    update public.schools
      set numspots = numspots + 1
      where id = new.school_id;
    return new;

  elsif (tg_op = 'DELETE') then
    update public.schools
      set numspots = greatest(numspots - 1, 0)
      where id = old.school_id;
    return old;

  elsif (tg_op = 'UPDATE') then
    -- Only react when a spot is reassigned to a different school.
    if new.school_id is distinct from old.school_id then
      update public.schools
        set numspots = greatest(numspots - 1, 0)
        where id = old.school_id;
      update public.schools
        set numspots = numspots + 1
        where id = new.school_id;
    end if;
    return new;
  end if;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Triggers
--    Fire AFTER the row change so the spots row is already committed to state.
-- -----------------------------------------------------------------------------
drop trigger if exists spots_sync_numspots_insert on public.spots;
create trigger spots_sync_numspots_insert
  after insert on public.spots
  for each row execute function public.sync_school_numspots();

drop trigger if exists spots_sync_numspots_delete on public.spots;
create trigger spots_sync_numspots_delete
  after delete on public.spots
  for each row execute function public.sync_school_numspots();

drop trigger if exists spots_sync_numspots_update on public.spots;
create trigger spots_sync_numspots_update
  after update of school_id on public.spots
  for each row execute function public.sync_school_numspots();

-- -----------------------------------------------------------------------------
-- 3. One-time backfill
--    Sets numspots to the actual spot count for every school so the column is
--    correct going forward. NOTE: this overwrites any pre-seeded numspots
--    values with the real count from the spots table.
-- -----------------------------------------------------------------------------
-- Schools that have spots: set numspots to the real count.
update public.schools s
set numspots = c.cnt
from (
  select school_id, count(*)::int as cnt
  from public.spots
  group by school_id
) c
where c.school_id = s.id
  and s.numspots is distinct from c.cnt;

-- Schools with no spots at all: reset any stale count to zero.
update public.schools s
set numspots = 0
where s.numspots <> 0
  and not exists (select 1 from public.spots sp where sp.school_id = s.id);
