-- Spot school labels use the geographically closest campus.
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
    ((s.latitude - p_lat) * (s.latitude - p_lat))
    + (
        (s.longitude - p_lng) * (s.longitude - p_lng)
        * cos(radians(p_lat)) * cos(radians(p_lat))
      ),
    s.id
  limit 1;
$$;

revoke all on function public.nearest_school(double precision, double precision) from public;
revoke all on function public.nearest_school(double precision, double precision) from anon;
revoke all on function public.nearest_school(double precision, double precision) from authenticated;
grant execute on function public.nearest_school(double precision, double precision) to service_role;

update public.spots as sp
set school_id = ns.id
from public.spots as src
cross join lateral public.nearest_school(src.latitude, src.longitude) as ns
where sp.id = src.id
  and sp.school_id is distinct from ns.id;
