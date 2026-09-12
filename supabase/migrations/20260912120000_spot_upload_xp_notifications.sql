-- Notify creators when a spot uploads, and keep status alerts unique.
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
      'spot_uploaded',
      'spot_under_review',
      'spot_removed'
    )
  );

drop index if exists public.user_notifications_spot_status_unique;

create unique index if not exists user_notifications_spot_status_unique
  on public.user_notifications (recipient_id, spot_id, type)
  where type in ('spot_approved', 'spot_uploaded', 'spot_under_review', 'spot_removed');

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
    'spot_uploaded',
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

create or replace function public.sync_notifications_from_spot_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending_moderation' then
      perform public.insert_user_notification(
        new.created_by_user_id,
        null,
        'spot_uploaded',
        new.id,
        null
      );
    elsif new.status = 'active' then
      perform public.insert_user_notification(
        new.created_by_user_id,
        null,
        'spot_approved',
        new.id,
        null
      );
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
