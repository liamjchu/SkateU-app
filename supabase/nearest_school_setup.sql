-- =============================================================================
-- SkateU — Nearest school for a lat/lng
-- Run in the Supabase SQL Editor after public.schools and public.spots exist.
-- Safe to re-run.
--
-- Spot create/edit calls GET/POST helpers that RPC this function so a pin is
-- always labeled with the geographically closest campus, not the school the
-- user happened to have open. The backfill updates existing spots the same way.
-- =============================================================================

create or replace function public.nearest_school(
  p_lat double precision,
  p_lng double precision
)
returns setof public.schools
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.schools s
  where p_lat between -90 and 90
    and p_lng between -180 and 180
  order by
    2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(s.latitude - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(s.latitude))
        * power(sin(radians(s.longitude - p_lng) / 2), 2)
    ))),
    s.id
  limit 1;
$$;

revoke all on function public.nearest_school(double precision, double precision) from public;
revoke all on function public.nearest_school(double precision, double precision) from anon;
revoke all on function public.nearest_school(double precision, double precision) from authenticated;
grant execute on function public.nearest_school(double precision, double precision) to service_role;

-- Override any client-supplied school_id with the closest campus.
create or replace function public.assign_spot_nearest_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  closest_id uuid;
begin
  select ns.id
  into closest_id
  from public.nearest_school(new.latitude, new.longitude) as ns;

  if closest_id is not null then
    new.school_id := closest_id;
  end if;

  return new;
end;
$$;

drop trigger if exists spots_assign_nearest_school on public.spots;
create trigger spots_assign_nearest_school
  before insert or update of latitude, longitude, school_id
  on public.spots
  for each row
  execute function public.assign_spot_nearest_school();

-- Reassign every spot to the closest campus. schools.numspots stays in sync
-- through spots_sync_numspots_update.
update public.spots as sp
set school_id = ns.id
from public.spots as src
cross join lateral public.nearest_school(src.latitude, src.longitude) as ns
where sp.id = src.id
  and sp.school_id is distinct from ns.id;
