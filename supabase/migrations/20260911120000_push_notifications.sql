-- =============================================================================
-- SkateU — Push tokens, saved schools, notification prefs, extra inbox types
-- Run after user_notifications, spots, spot_likes, spot_comments, schools.
-- Safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists push_enabled boolean not null default true;

alter table public.profiles
  add column if not exists notify_social boolean not null default true;

alter table public.profiles
  add column if not exists notify_campus boolean not null default true;

alter table public.profiles
  add column if not exists notify_spot_updates boolean not null default true;

comment on column public.profiles.push_enabled is
  'Master push opt-in. In-app inbox is unchanged when this is false.';
comment on column public.profiles.notify_social is
  'Push for likes, comments, replies, and follows.';
comment on column public.profiles.notify_campus is
  'Push for new spots at saved schools and comments on liked spots.';
comment on column public.profiles.notify_spot_updates is
  'Push when the user’s spot is approved, under review, or removed.';

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null,
  platform text not null
    constraint push_tokens_platform_check
    check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_user_token_key unique (user_id, expo_push_token)
);

comment on table public.push_tokens is
  'Expo push tokens. Direct browser access is blocked by RLS. Writes use the service-role key.';

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

revoke all on table public.push_tokens from public;
revoke all on table public.push_tokens from anon;
revoke all on table public.push_tokens from authenticated;
grant all on table public.push_tokens to service_role;

create table if not exists public.user_saved_schools (
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, school_id)
);

comment on table public.user_saved_schools is
  'Schools the user saved. Used for campus push. Direct browser access is blocked by RLS.';

create index if not exists user_saved_schools_school_id_idx
  on public.user_saved_schools (school_id);

alter table public.user_saved_schools enable row level security;

revoke all on table public.user_saved_schools from public;
revoke all on table public.user_saved_schools from anon;
revoke all on table public.user_saved_schools from authenticated;
grant all on table public.user_saved_schools to service_role;

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (
    type in (
      'spot_like',
      'spot_comment',
      'comment_reply',
      'follow',
      'saved_school_spot',
      'liked_spot_comment',
      'spot_approved',
      'spot_under_review',
      'spot_removed'
    )
  );

drop index if exists public.user_notifications_comment_unique;

create unique index if not exists user_notifications_comment_recipient_unique
  on public.user_notifications (recipient_id, comment_id)
  where comment_id is not null;

create unique index if not exists user_notifications_saved_school_spot_unique
  on public.user_notifications (recipient_id, spot_id)
  where type = 'saved_school_spot';

create unique index if not exists user_notifications_spot_status_unique
  on public.user_notifications (recipient_id, spot_id, type)
  where type in ('spot_approved', 'spot_under_review', 'spot_removed');

create or replace function public.insert_user_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_spot_id uuid,
  p_comment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_system boolean;
begin
  if p_recipient_id is null or p_type is null then
    return;
  end if;

  is_system := p_type in (
    'spot_approved',
    'spot_under_review',
    'spot_removed'
  );

  if not is_system and p_actor_id is null then
    return;
  end if;

  if p_recipient_id is not distinct from p_actor_id then
    return;
  end if;

  if p_actor_id is not null and public.users_are_blocked(p_recipient_id, p_actor_id) then
    return;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_recipient_id
  ) then
    return;
  end if;

  if p_actor_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
  ) then
    return;
  end if;

  insert into public.user_notifications (
    recipient_id,
    actor_id,
    type,
    spot_id,
    comment_id
  )
  values (
    p_recipient_id,
    p_actor_id,
    p_type,
    p_spot_id,
    p_comment_id
  )
  on conflict do nothing;
end;
$$;

create or replace function public.sync_notifications_from_spot_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  owner_id uuid;
  liker_id uuid;
  liker_count integer := 0;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.user_id is null then
    return new;
  end if;

  if new.parent_comment_id is not null then
    select c.user_id into recipient_id
    from public.spot_comments c
    where c.id = new.parent_comment_id;

    perform public.insert_user_notification(
      recipient_id,
      new.user_id,
      'comment_reply',
      new.spot_id,
      new.id
    );
    return new;
  end if;

  select s.created_by_user_id into owner_id
  from public.spots s
  where s.id = new.spot_id;

  perform public.insert_user_notification(
    owner_id,
    new.user_id,
    'spot_comment',
    new.spot_id,
    new.id
  );

  for liker_id in
    select sl.user_id
    from public.spot_likes sl
    where sl.spot_id = new.spot_id
      and sl.user_id is distinct from new.user_id
      and sl.user_id is distinct from owner_id
    order by sl.created_at desc
    limit 50
  loop
    liker_count := liker_count + 1;
    perform public.insert_user_notification(
      liker_id,
      new.user_id,
      'liked_spot_comment',
      new.spot_id,
      new.id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists spot_comments_sync_notifications on public.spot_comments;
create trigger spot_comments_sync_notifications
after insert
on public.spot_comments
for each row execute function public.sync_notifications_from_spot_comment();

create or replace function public.notify_saved_school_spot(p_spot public.spots)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  saver_id uuid;
begin
  if p_spot.status is distinct from 'active' then
    return;
  end if;

  if p_spot.school_id is null then
    return;
  end if;

  for saver_id in
    select uss.user_id
    from public.user_saved_schools uss
    where uss.school_id = p_spot.school_id
      and uss.user_id is distinct from p_spot.created_by_user_id
    order by uss.created_at desc
    limit 200
  loop
    perform public.insert_user_notification(
      saver_id,
      p_spot.created_by_user_id,
      'saved_school_spot',
      p_spot.id,
      null
    );
  end loop;
end;
$$;

create or replace function public.sync_notifications_from_spot_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      perform public.notify_saved_school_spot(new);
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'pending_moderation' and new.status = 'active' then
    perform public.insert_user_notification(
      new.created_by_user_id,
      null,
      'spot_approved',
      new.id,
      null
    );
    perform public.notify_saved_school_spot(new);
    return new;
  end if;

  if new.status = 'under_review' then
    perform public.insert_user_notification(
      new.created_by_user_id,
      null,
      'spot_under_review',
      new.id,
      null
    );
    return new;
  end if;

  if new.status = 'removed' then
    perform public.insert_user_notification(
      new.created_by_user_id,
      null,
      'spot_removed',
      new.id,
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists spots_sync_notifications on public.spots;
create trigger spots_sync_notifications
after insert or update of status
on public.spots
for each row execute function public.sync_notifications_from_spot_status();
