-- =============================================================================
-- SkateU — Legal acceptance columns on profiles
-- Run this in the Supabase SQL Editor after profiles_setup.sql.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
--
-- Clients cannot write legal_version, legal_accepted_at, or age_attested_at.
-- Those fields are recorded only by the server accept-legal route using the
-- service-role key.
--
-- After this script, run profile_legal_private_setup.sql to move these columns
-- onto public.profile_legal so they are not publicly readable.
-- =============================================================================

alter table public.profiles
  add column if not exists legal_version text;

alter table public.profiles
  add column if not exists legal_accepted_at timestamptz;

alter table public.profiles
  add column if not exists age_attested_at timestamptz;

create or replace function public.protect_profile_legal_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.legal_version is distinct from old.legal_version
     or new.legal_accepted_at is distinct from old.legal_accepted_at
     or new.age_attested_at is distinct from old.age_attested_at then
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then
      raise exception 'Profile legal acceptance columns cannot be changed by clients';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_legal_columns on public.profiles;
create trigger profiles_protect_legal_columns
  before update on public.profiles
  for each row execute function public.protect_profile_legal_columns();
