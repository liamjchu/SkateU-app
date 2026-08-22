-- =============================================================================
-- SkateU — Schools directory
-- Run this FIRST in the Supabase SQL Editor, before spots_setup.sql and
-- school_search_setup.sql. Safe to re-run: uses IF NOT EXISTS.
--
-- Home search and campus maps read this table through GET /api/schools
-- (service_role). Seed rows with: npm run seed:schools -- --csv all_us_schools.csv
-- =============================================================================

create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null,
  state      text not null check (char_length(state) = 2),
  latitude   double precision not null check (latitude between -90 and 90),
  longitude  double precision not null check (longitude between -180 and 180),
  numspots   integer not null default 0 check (numspots >= 0),
  type       text not null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schools_type_valid'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_type_valid
      check (type in ('k12_public', 'k12_private', 'higher_ed'));
  end if;
end;
$$;

create index if not exists schools_name_idx on public.schools (name);
create index if not exists schools_city_idx on public.schools (city);
create index if not exists schools_numspots_id_idx on public.schools (numspots desc, id asc);
create index if not exists schools_type_idx on public.schools (type);

alter table public.schools enable row level security;

-- No anon/authenticated policies. Reads and writes go through server routes
-- and the seed script with the service-role key, which bypasses RLS.

revoke all on table public.schools from public;
revoke all on table public.schools from anon;
revoke all on table public.schools from authenticated;
grant all on table public.schools to service_role;
