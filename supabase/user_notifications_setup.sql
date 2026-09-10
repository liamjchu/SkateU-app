-- =============================================================================
-- SkateU — In-app activity notifications
-- Run after spot_likes, spot_comments, user_follows, and user_blocks.
-- Safe to re-run.
--
-- One row per like, top-level comment on your spot, reply to your comment,
-- or new follower. Hidden rows stay so an active like/follow cannot recreate
-- the same notification. Unlikes, unfollows, and deleted comments remove the
-- matching row so a later action can notify again.
--
-- Inbox:
--   select * from public.user_notifications order by created_at desc;
-- =============================================================================

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null
    constraint user_notifications_type_check
    check (
      type in (
        'spot_like',
        'spot_comment',
        'comment_reply',
        'follow'
      )
    ),
  spot_id uuid references public.spots (id) on delete cascade,
  comment_id uuid references public.spot_comments (id) on delete cascade,
  read_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.user_notifications is
'In-app activity inbox. Direct browser access is blocked by RLS. Writes are performed by triggers and the API with the service-role key.';

create unique index if not exists user_notifications_like_unique
  on public.user_notifications (recipient_id, actor_id, spot_id)
  where type = 'spot_like';

create unique index if not exists user_notifications_follow_unique
  on public.user_notifications (recipient_id, actor_id)
  where type = 'follow';

create unique index if not exists user_notifications_comment_unique
  on public.user_notifications (comment_id)
  where comment_id is not null;

create index if not exists user_notifications_recipient_created_at_idx
  on public.user_notifications (recipient_id, created_at desc)
  where hidden_at is null;

create index if not exists user_notifications_recipient_unread_idx
  on public.user_notifications (recipient_id)
  where hidden_at is null and read_at is null;

alter table public.user_notifications enable row level security;

revoke all on table public.user_notifications from public;
revoke all on table public.user_notifications from anon;
revoke all on table public.user_notifications from authenticated;
grant all on table public.user_notifications to service_role;

create or replace function public.users_are_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    user_a is not null
    and user_b is not null
    and user_a is distinct from user_b
    and exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = user_a and b.blocked_id = user_b)
         or (b.blocker_id = user_b and b.blocked_id = user_a)
    );
$$;

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
begin
  if p_recipient_id is null or p_actor_id is null or p_type is null then
    return;
  end if;

  if p_recipient_id is not distinct from p_actor_id then
    return;
  end if;

  if public.users_are_blocked(p_recipient_id, p_actor_id) then
    return;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_recipient_id
  ) then
    return;
  end if;

  if not exists (
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

create or replace function public.sync_notifications_from_spot_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'INSERT' then
    select s.created_by_user_id into owner_id
    from public.spots s
    where s.id = new.spot_id;

    perform public.insert_user_notification(
      owner_id,
      new.user_id,
      'spot_like',
      new.spot_id,
      null
    );
    return new;
  end if;

  delete from public.user_notifications n
  where n.type = 'spot_like'
    and n.spot_id = old.spot_id
    and n.actor_id is not distinct from old.user_id;

  return old;
end;
$$;

drop trigger if exists spot_likes_sync_notifications on public.spot_likes;
create trigger spot_likes_sync_notifications
after insert or delete
on public.spot_likes
for each row execute function public.sync_notifications_from_spot_like();

create or replace function public.sync_notifications_from_spot_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
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

  select s.created_by_user_id into recipient_id
  from public.spots s
  where s.id = new.spot_id;

  perform public.insert_user_notification(
    recipient_id,
    new.user_id,
    'spot_comment',
    new.spot_id,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists spot_comments_sync_notifications on public.spot_comments;
create trigger spot_comments_sync_notifications
after insert
on public.spot_comments
for each row execute function public.sync_notifications_from_spot_comment();

create or replace function public.sync_notifications_from_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.insert_user_notification(
      new.following_id,
      new.follower_id,
      'follow',
      null,
      null
    );
    return new;
  end if;

  delete from public.user_notifications n
  where n.type = 'follow'
    and n.recipient_id = old.following_id
    and n.actor_id is not distinct from old.follower_id;

  return old;
end;
$$;

drop trigger if exists user_follows_sync_notifications on public.user_follows;
create trigger user_follows_sync_notifications
after insert or delete
on public.user_follows
for each row execute function public.sync_notifications_from_follow();
