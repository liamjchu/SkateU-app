-- =============================================================================
-- SkateU — Live XP totals, event history, and rank source of truth
-- Run after spots, spot_likes, and spot_comments. Safe to re-run.
--
-- Formula (eligible spots only: active + under_review):
--   10 XP per approved spot
--    5 XP per like from someone other than the owner
--    1 XP per comment from someone other than the owner (replies included)
-- Own likes and own comments never count. Totals are recomputed from current
-- rows so unlikes, deleted comments, and removed spots drop XP.
-- =============================================================================

alter table public.profiles
  add column if not exists xp_total integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_xp_total_nonnegative'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_xp_total_nonnegative check (xp_total >= 0);
  end if;
end;
$$;

create or replace function public.profile_xp_total_is_unchanged(
  profile_id uuid,
  candidate_xp_total integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select existing.xp_total is not distinct from candidate_xp_total
  from public.profiles as existing
  where existing.id = profile_id;
$$;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_username_is_unchanged(id, username)
    and public.profile_avatar_url_is_unchanged(id, avatar_url)
    and public.profile_bio_is_unchanged(id, bio)
    and public.profile_xp_total_is_unchanged(id, xp_total)
  );

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null
    constraint xp_events_reason_check
    check (
      reason in (
        'spot_approved',
        'spot_unapproved',
        'like_received',
        'like_removed',
        'comment_received',
        'comment_removed'
      )
    ),
  spot_id uuid references public.spots (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint xp_events_delta_nonzero check (delta <> 0)
);

create index if not exists xp_events_user_id_created_at_idx
  on public.xp_events (user_id, created_at desc);

alter table public.xp_events enable row level security;

revoke all on table public.xp_events from public;
revoke all on table public.xp_events from anon;
revoke all on table public.xp_events from authenticated;
grant all on table public.xp_events to service_role;

create or replace function public.spot_is_xp_eligible(status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select status in ('active', 'under_review');
$$;

create or replace function public.compute_user_xp(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select count(*)::int * 10
    from public.spots s
    where s.created_by_user_id = target_user_id
      and public.spot_is_xp_eligible(s.status)
  ), 0)
  + coalesce((
    select count(*)::int * 5
    from public.spot_likes sl
    inner join public.spots s on s.id = sl.spot_id
    where s.created_by_user_id = target_user_id
      and sl.user_id is distinct from target_user_id
      and public.spot_is_xp_eligible(s.status)
  ), 0)
  + coalesce((
    select count(*)::int
    from public.spot_comments sc
    inner join public.spots s on s.id = sc.spot_id
    where s.created_by_user_id = target_user_id
      and sc.user_id is distinct from target_user_id
      and public.spot_is_xp_eligible(s.status)
  ), 0);
$$;

create or replace function public.sync_user_xp(
  target_user_id uuid,
  reason text,
  event_spot_id uuid,
  actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_xp integer;
  new_xp integer;
  delta integer;
begin
  if target_user_id is null then
    return;
  end if;

  select p.xp_total into old_xp
  from public.profiles p
  where p.id = target_user_id;

  if old_xp is null then
    return;
  end if;

  new_xp := public.compute_user_xp(target_user_id);
  delta := new_xp - old_xp;

  if delta = 0 then
    return;
  end if;

  update public.profiles
  set xp_total = new_xp
  where id = target_user_id;

  insert into public.xp_events (
    user_id,
    delta,
    reason,
    spot_id,
    actor_user_id
  )
  values (
    target_user_id,
    delta,
    reason,
    event_spot_id,
    actor_user_id
  );
end;
$$;

create or replace function public.sync_xp_from_spot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text;
begin
  if tg_op = 'INSERT' then
    if new.created_by_user_id is not null
       and public.spot_is_xp_eligible(new.status) then
      perform public.sync_user_xp(
        new.created_by_user_id,
        'spot_approved',
        new.id,
        new.created_by_user_id
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.created_by_user_id is not null
       and old.created_by_user_id is distinct from new.created_by_user_id then
      perform public.sync_user_xp(
        old.created_by_user_id,
        'spot_unapproved',
        old.id,
        old.created_by_user_id
      );
    end if;

    if new.created_by_user_id is not null then
      if public.spot_is_xp_eligible(old.status)
         and not public.spot_is_xp_eligible(new.status) then
        reason := 'spot_unapproved';
      elsif not public.spot_is_xp_eligible(old.status)
         and public.spot_is_xp_eligible(new.status) then
        reason := 'spot_approved';
      elsif old.created_by_user_id is distinct from new.created_by_user_id
         and public.spot_is_xp_eligible(new.status) then
        reason := 'spot_approved';
      else
        return new;
      end if;

      perform public.sync_user_xp(
        new.created_by_user_id,
        reason,
        new.id,
        new.created_by_user_id
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.created_by_user_id is not null then
      perform public.sync_user_xp(
        old.created_by_user_id,
        'spot_unapproved',
        old.id,
        old.created_by_user_id
      );
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists spots_sync_xp on public.spots;
create trigger spots_sync_xp
after insert or update of status, created_by_user_id or delete
on public.spots
for each row execute function public.sync_xp_from_spot();

create or replace function public.sync_xp_from_spot_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  event_spot_id uuid;
  actor_id uuid;
  reason text;
begin
  if tg_op = 'INSERT' then
    event_spot_id := new.spot_id;
    actor_id := new.user_id;
    reason := 'like_received';
  else
    event_spot_id := old.spot_id;
    actor_id := old.user_id;
    reason := 'like_removed';
  end if;

  select s.created_by_user_id into owner_id
  from public.spots s
  where s.id = event_spot_id;

  if owner_id is null or actor_id is not distinct from owner_id then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform public.sync_user_xp(owner_id, reason, event_spot_id, actor_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists spot_likes_sync_xp on public.spot_likes;
create trigger spot_likes_sync_xp
after insert or delete
on public.spot_likes
for each row execute function public.sync_xp_from_spot_like();

create or replace function public.sync_xp_from_spot_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  event_spot_id uuid;
  actor_id uuid;
  reason text;
begin
  if tg_op = 'INSERT' then
    event_spot_id := new.spot_id;
    actor_id := new.user_id;
    reason := 'comment_received';
  else
    event_spot_id := old.spot_id;
    actor_id := old.user_id;
    reason := 'comment_removed';
  end if;

  select s.created_by_user_id into owner_id
  from public.spots s
  where s.id = event_spot_id;

  if owner_id is null or actor_id is not distinct from owner_id then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  perform public.sync_user_xp(owner_id, reason, event_spot_id, actor_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists spot_comments_sync_xp on public.spot_comments;
create trigger spot_comments_sync_xp
after insert or delete
on public.spot_comments
for each row execute function public.sync_xp_from_spot_comment();

update public.profiles p
set xp_total = public.compute_user_xp(p.id)
where p.xp_total is distinct from public.compute_user_xp(p.id);

do $$
begin
  if exists (select 1 from public.xp_events limit 1) then
    return;
  end if;

  insert into public.xp_events (
    user_id,
    delta,
    reason,
    spot_id,
    actor_user_id,
    created_at
  )
  select
    s.created_by_user_id,
    10,
    'spot_approved',
    s.id,
    s.created_by_user_id,
    coalesce(s.reviewed_at, s.created_at, now())
  from public.spots s
  where s.created_by_user_id is not null
    and public.spot_is_xp_eligible(s.status);

  insert into public.xp_events (
    user_id,
    delta,
    reason,
    spot_id,
    actor_user_id,
    created_at
  )
  select
    s.created_by_user_id,
    5,
    'like_received',
    sl.spot_id,
    sl.user_id,
    sl.created_at
  from public.spot_likes sl
  inner join public.spots s on s.id = sl.spot_id
  where s.created_by_user_id is not null
    and sl.user_id is distinct from s.created_by_user_id
    and public.spot_is_xp_eligible(s.status);

  insert into public.xp_events (
    user_id,
    delta,
    reason,
    spot_id,
    actor_user_id,
    created_at
  )
  select
    s.created_by_user_id,
    1,
    'comment_received',
    sc.spot_id,
    sc.user_id,
    sc.created_at
  from public.spot_comments sc
  inner join public.spots s on s.id = sc.spot_id
  where s.created_by_user_id is not null
    and sc.user_id is distinct from s.created_by_user_id
    and public.spot_is_xp_eligible(s.status);
end;
$$;
