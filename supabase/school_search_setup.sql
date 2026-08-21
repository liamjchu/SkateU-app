-- =============================================================================
-- SkateU — Ranked school search (trigram indexes + search_schools RPC)
-- Run this in the Supabase SQL Editor AFTER the public.schools table exists.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- Home search calls GET /api/schools?search=..., and that route POSTs to
-- public.search_schools. The function is executable by service_role only.
--
-- Matching:
--   1. name/city ILIKE %query% (backslash-escaped)
--   2. exact 2-letter state code (RI, CA) — not a substring of state/name
--   3. light typos when the query is at least 4 characters
-- Ranking: exact name, name prefix, name word, name contains, city,
--          exact state, then fuzzy; ties break on numspots desc, name asc.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trigram extension + indexes
--    Leading-wildcard ILIKE and similarity() can use these GIN indexes.
--    pg_trgm may already live in `public` or `extensions`. Create indexes
--    with unqualified gin_trgm_ops after putting that schema on search_path.
-- -----------------------------------------------------------------------------
do $ext$
begin
  create extension if not exists pg_trgm with schema extensions;
exception
  when duplicate_object then
    null;
  when others then
    create extension if not exists pg_trgm;
end;
$ext$;

do $idx$
declare
  trgm_schema text;
begin
  select n.nspname
  into trgm_schema
  from pg_opclass opc
  join pg_namespace n on n.oid = opc.opcnamespace
  join pg_am am on am.oid = opc.opcmethod
  where opc.opcname = 'gin_trgm_ops'
    and am.amname = 'gin'
  order by case n.nspname
    when 'extensions' then 0
    when 'public' then 1
    else 2
  end
  limit 1;

  if trgm_schema is null then
    raise exception 'pg_trgm gin_trgm_ops was not found. Enable pg_trgm in Database → Extensions.';
  end if;

  -- Unqualified gin_trgm_ops resolves via search_path.
  perform set_config('search_path', trgm_schema || ', public', true);

  execute 'create index if not exists schools_name_trgm_idx on public.schools using gin (name gin_trgm_ops)';
  execute 'create index if not exists schools_city_trgm_idx on public.schools using gin (city gin_trgm_ops)';
end;
$idx$;

-- -----------------------------------------------------------------------------
-- 2. search_schools
-- -----------------------------------------------------------------------------
drop function if exists public.search_schools(text, text[], integer);

create or replace function public.search_schools(
  p_query text,
  p_types text[] default null,
  p_limit integer default 20
)
returns table (
  id public.schools.id%type,
  name public.schools.name%type,
  city public.schools.city%type,
  state public.schools.state%type,
  latitude public.schools.latitude%type,
  longitude public.schools.longitude%type,
  numspots public.schools.numspots%type,
  type public.schools.type%type
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select left(trim(both from coalesce(p_query, '')), 80) as query
  ),
  escaped as (
    select
      query,
      replace(
        replace(
          replace(query, chr(92), chr(92) || chr(92)),
          '%',
          chr(92) || '%'
        ),
        '_',
        chr(92) || '_'
      ) as like_query
    from input
  )
  select
    s.id,
    s.name,
    s.city,
    s.state,
    s.latitude,
    s.longitude,
    s.numspots,
    s.type
  from public.schools s
  cross join escaped e
  where char_length(e.query) >= 2
    and (p_types is null or s.type::text = any (p_types))
    and (
      s.name ilike '%' || e.like_query || '%' escape chr(92)
      or s.city ilike '%' || e.like_query || '%' escape chr(92)
      or (
        char_length(e.query) = 2
        and s.state = upper(e.query)
      )
      or (
        char_length(e.query) >= 4
        and (
          similarity(s.name, e.query) >= 0.4
          or word_similarity(e.query, s.name) >= 0.45
        )
      )
    )
  order by
    case
      when lower(s.name) = lower(e.query) then 1
      when s.name ilike e.like_query || '%' escape chr(92) then 2
      when s.name ilike '% ' || e.like_query || '%' escape chr(92) then 3
      when s.name ilike '%' || e.like_query || '%' escape chr(92) then 4
      when s.city ilike e.like_query || '%' escape chr(92)
        or s.city ilike '%' || e.like_query || '%' escape chr(92) then 5
      when char_length(e.query) = 2 and s.state = upper(e.query) then 6
      else 7
    end,
    s.numspots desc,
    s.name asc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.search_schools(text, text[], integer) from public;
revoke all on function public.search_schools(text, text[], integer) from anon;
revoke all on function public.search_schools(text, text[], integer) from authenticated;
grant execute on function public.search_schools(text, text[], integer) to service_role;
