-- Always attach a pin to the geographically closest campus, even when a client
-- still sends the school the user had selected in an older app build.
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

update public.spots as sp
set school_id = ns.id
from public.spots as src
cross join lateral public.nearest_school(src.latitude, src.longitude) as ns
where sp.id = src.id
  and sp.school_id is distinct from ns.id;
