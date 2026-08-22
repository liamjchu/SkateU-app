-- =============================================================================
-- SkateU — Private legal acceptance table
-- Run this after profiles_setup.sql and profile_legal_acceptance_setup.sql.
-- Safe to re-run.
--
-- Legal timestamps are not publicly readable. Clients cannot SELECT or write
-- this table; the accept-legal API uses the service-role key.
-- =============================================================================

create table if not exists public.profile_legal (
  id uuid primary key references public.profiles (id) on delete cascade,
  legal_version text,
  legal_accepted_at timestamptz,
  age_attested_at timestamptz
);

alter table public.profile_legal enable row level security;

revoke all on table public.profile_legal from public, anon, authenticated;
grant all on table public.profile_legal to postgres, service_role;

create or replace function public.protect_profile_legal_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'Profile legal acceptance rows cannot be changed by clients';
  end if;

  return new;
end;
$$;

drop trigger if exists profile_legal_protect_row on public.profile_legal;
create trigger profile_legal_protect_row
  before insert or update on public.profile_legal
  for each row execute function public.protect_profile_legal_row();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'legal_version'
  ) then
    insert into public.profile_legal (
      id,
      legal_version,
      legal_accepted_at,
      age_attested_at
    )
    select
      id,
      legal_version,
      legal_accepted_at,
      age_attested_at
    from public.profiles
    on conflict (id) do update
      set legal_version = excluded.legal_version,
          legal_accepted_at = excluded.legal_accepted_at,
          age_attested_at = excluded.age_attested_at;
  end if;
end;
$$;

drop trigger if exists profiles_protect_legal_columns on public.profiles;
drop function if exists public.protect_profile_legal_columns();

alter table public.profiles drop column if exists legal_version;
alter table public.profiles drop column if exists legal_accepted_at;
alter table public.profiles drop column if exists age_attested_at;

notify pgrst, 'reload schema';
