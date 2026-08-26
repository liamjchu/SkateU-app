-- =============================================================================
-- SkateU — Spot removal requests, spot moderation status, and review helpers
-- Run this in the Supabase SQL Editor AFTER spots_setup.sql and
-- spots_count_trigger.sql. Safe to re-run.
--
-- Review queue (SQL editor / service role only):
--   select * from public.spots_needing_review;
--
-- Keep a spot (resets the unique-user window; original reporters cannot
-- report this spot again because of unique(spot_id, user_id)):
--   update public.spots
--   set status = 'active',
--       reviewed_at = now(),
--       review_notified_at = null
--   where id = '<spot-uuid>';
--
-- Remove a spot (soft-hide; does not delete the row, comments, likes, or images):
--   update public.spots
--   set status = 'removed',
--       reviewed_at = now()
--   where id = '<spot-uuid>';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Spot moderation columns
-- -----------------------------------------------------------------------------
alter table public.spots
  add column if not exists status text not null default 'active';

alter table public.spots
  add column if not exists reviewed_at timestamptz;

alter table public.spots
  add column if not exists review_notified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'spots_status_valid'
      and conrelid = 'public.spots'::regclass
  ) then
    alter table public.spots
      add constraint spots_status_valid
      check (status in ('active', 'under_review', 'pending_moderation', 'removed'));
  end if;
end;
$$;

create index if not exists spots_status_idx
  on public.spots (status);

-- Public and authenticated clients may still read active and under_review
-- spots. Removed spots are hidden from PostgREST even though the API uses
-- the service-role key and filters separately.
drop policy if exists "Spots are publicly readable" on public.spots;
create policy "Spots are publicly readable"
  on public.spots
  for select
  using (status in ('active', 'under_review'));

-- -----------------------------------------------------------------------------
-- 2. Clients must not change moderation columns (owners can still edit copy,
--    photos, and location through the existing UPDATE policy).
-- -----------------------------------------------------------------------------
create or replace function public.protect_spot_moderation_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.review_notified_at is distinct from old.review_notified_at then
    if coalesce(auth.role(), '') in ('authenticated', 'anon') then
      raise exception 'Spot moderation columns cannot be changed by clients';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists spots_protect_moderation_columns on public.spots;
create trigger spots_protect_moderation_columns
  before update on public.spots
  for each row execute function public.protect_spot_moderation_columns();

-- -----------------------------------------------------------------------------
-- 3. Removal requests — one row per user per spot, forever
-- -----------------------------------------------------------------------------
create table if not exists public.spot_removal_requests (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references public.spots (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reason     text not null check (reason in (
               'no_longer_exists',
               'private_restricted',
               'incorrect_location',
               'dangerous',
               'duplicate',
               'other'
             )),
  details    text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'spot_removal_requests_spot_id_user_id_key'
      and conrelid = 'public.spot_removal_requests'::regclass
  ) then
    alter table public.spot_removal_requests
      add constraint spot_removal_requests_spot_id_user_id_key unique (spot_id, user_id);
  end if;
end;
$$;

create index if not exists spot_removal_requests_spot_id_created_at_idx
  on public.spot_removal_requests (spot_id, created_at);

create index if not exists spot_removal_requests_user_id_created_at_idx
  on public.spot_removal_requests (user_id, created_at desc);

alter table public.spot_removal_requests enable row level security;

drop policy if exists "Users can read own spot removal requests"
  on public.spot_removal_requests;
create policy "Users can read own spot removal requests"
  on public.spot_removal_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own spot removal requests"
  on public.spot_removal_requests;
create policy "Users can insert own spot removal requests"
  on public.spot_removal_requests
  for insert
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. Threshold: 2 unique users since last Keep → under_review
--    Does not hide or delete the spot. Does not notify (the API does that).
-- -----------------------------------------------------------------------------
create or replace function public.apply_spot_removal_request_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_reviewed_at timestamptz;
  request_count integer;
begin
  select s.status, s.reviewed_at
    into current_status, current_reviewed_at
  from public.spots s
  where s.id = new.spot_id;

  if current_status is distinct from 'active' then
    return new;
  end if;

  select count(*)::int
    into request_count
  from public.spot_removal_requests r
  where r.spot_id = new.spot_id
    and r.created_at > coalesce(current_reviewed_at, '-infinity'::timestamptz);

  if request_count >= 2 then
    update public.spots
      set status = 'under_review'
    where id = new.spot_id
      and status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists spot_removal_requests_apply_threshold
  on public.spot_removal_requests;
create trigger spot_removal_requests_apply_threshold
  after insert on public.spot_removal_requests
  for each row execute function public.apply_spot_removal_request_threshold();

-- -----------------------------------------------------------------------------
-- 5. schools.numspots ignores removed spots
--    Replaces the function from spots_count_trigger.sql now that status exists.
-- -----------------------------------------------------------------------------
create or replace function public.sync_school_numspots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') then
    if new.status is distinct from 'removed' then
      update public.schools
        set numspots = numspots + 1
        where id = new.school_id;
    end if;
    return new;

  elsif (tg_op = 'DELETE') then
    if old.status is distinct from 'removed' then
      update public.schools
        set numspots = greatest(numspots - 1, 0)
        where id = old.school_id;
    end if;
    return old;

  elsif (tg_op = 'UPDATE') then
    if new.school_id is not distinct from old.school_id
       and new.status is not distinct from old.status then
      return new;
    end if;

    if old.status is distinct from 'removed' then
      update public.schools
        set numspots = greatest(numspots - 1, 0)
        where id = old.school_id;
    end if;

    if new.status is distinct from 'removed' then
      update public.schools
        set numspots = numspots + 1
        where id = new.school_id;
    end if;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists spots_sync_numspots_update on public.spots;
create trigger spots_sync_numspots_update
  after update on public.spots
  for each row execute function public.sync_school_numspots();

update public.schools s
set numspots = c.cnt
from (
  select school_id, count(*)::int as cnt
  from public.spots
  where status is distinct from 'removed'
  group by school_id
) c
where c.school_id = s.id
  and s.numspots is distinct from c.cnt;

update public.schools s
set numspots = 0
where s.numspots <> 0
  and not exists (
    select 1
    from public.spots sp
    where sp.school_id = s.id
      and sp.status is distinct from 'removed'
  );

-- -----------------------------------------------------------------------------
-- 6. Review view — not granted to anon or authenticated
-- -----------------------------------------------------------------------------
create or replace view public.spots_needing_review as
select
  s.id,
  s.name,
  s.status,
  s.created_by_user_id,
  p.username as creator_username,
  s.school_id,
  sch.name as school_name,
  s.created_at,
  s.reviewed_at,
  count(r.id)::int as unique_request_count,
  array_agg(r.reason order by r.created_at) as reasons,
  array_agg(nullif(r.details, '') order by r.created_at) as details,
  array_agg(r.user_id order by r.created_at) as requester_ids,
  array_agg(r.created_at order by r.created_at) as requested_at
from public.spots s
left join public.profiles p on p.id = s.created_by_user_id
left join public.schools sch on sch.id = s.school_id
join public.spot_removal_requests r
  on r.spot_id = s.id
 and r.created_at > coalesce(s.reviewed_at, '-infinity'::timestamptz)
where s.status = 'under_review'
group by
  s.id,
  s.name,
  s.status,
  s.created_by_user_id,
  p.username,
  s.school_id,
  sch.name,
  s.created_at,
  s.reviewed_at;

revoke all on table public.spots_needing_review from public;
revoke all on table public.spots_needing_review from anon;
revoke all on table public.spots_needing_review from authenticated;
