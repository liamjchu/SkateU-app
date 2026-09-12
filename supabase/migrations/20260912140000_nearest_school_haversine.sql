-- Match client haversine ranking so pins attach to the closest campus.
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

update public.spots as sp
set school_id = ns.id
from public.spots as src
cross join lateral public.nearest_school(src.latitude, src.longitude) as ns
where sp.id = src.id
  and sp.school_id is distinct from ns.id;
