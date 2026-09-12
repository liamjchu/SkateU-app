-- Spot owners earn +1 XP for every comment, including replies. Notify them
-- with spot_comment so the inbox and push body can show the XP boost.
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

  if new.parent_comment_id is not null then
    select c.user_id into recipient_id
    from public.spot_comments c
    where c.id = new.parent_comment_id;

    if recipient_id is distinct from owner_id then
      perform public.insert_user_notification(
        recipient_id,
        new.user_id,
        'comment_reply',
        new.spot_id,
        new.id
      );
    end if;
    return new;
  end if;

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
