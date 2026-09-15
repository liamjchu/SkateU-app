-- 1. Deleting a live spot failed after XP shipped: AFTER DELETE sync_user_xp
--    inserted xp_events.spot_id = the row that was just removed, which
--    violates the spots FK. Log the XP change with a null spot_id instead.
-- 2. user_blocks lived only in a one-off setup script, so production projects
--    that applied migrations/ never got the table. Signed-in profile loads
--    then 500 on GET /api/profiles.
-- 3. Re-drop the spot-problem feedback check in case that migration was skipped.

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
        null,
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

alter table if exists public.user_feedback
  drop constraint if exists user_feedback_spot_problem_requires_spot;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

revoke all on table public.user_blocks from public;
revoke all on table public.user_blocks from anon;
revoke all on table public.user_blocks from authenticated;
grant all on table public.user_blocks to service_role;
