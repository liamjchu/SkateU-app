-- =============================================================================
-- SkateU — Persistent spot likes and denormalized like counts
-- Run after spots_setup.sql. Safe to re-run.
-- =============================================================================

-- Keep the count on spots so public spot lists can render it in one query.
alter table public.spots
  add column if not exists likes_count integer not null default 0;

-- Enforce a valid, non-negative count even if a maintenance query runs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'spots_likes_count_nonnegative'
      and conrelid = 'public.spots'::regclass
  ) then
    alter table public.spots
      add constraint spots_likes_count_nonnegative check (likes_count >= 0);
  end if;
end;
$$;

create table if not exists public.spot_likes (
  spot_id    uuid not null references public.spots (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);

create index if not exists spot_likes_user_id_created_at_idx
  on public.spot_likes (user_id, created_at desc);

create or replace function public.sync_spot_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.spots
      set likes_count = likes_count + 1
      where id = new.spot_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.spots
      set likes_count = greatest(likes_count - 1, 0)
      where id = old.spot_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists spot_likes_increment_count on public.spot_likes;
create trigger spot_likes_increment_count
after insert on public.spot_likes
for each row execute function public.sync_spot_likes_count();

drop trigger if exists spot_likes_decrement_count on public.spot_likes;
create trigger spot_likes_decrement_count
after delete on public.spot_likes
for each row execute function public.sync_spot_likes_count();

-- Repair counts for spots that existed before this feature was installed.
update public.spots s
set likes_count = counts.like_count
from (
  select spot_id, count(*)::int as like_count
  from public.spot_likes
  group by spot_id
) counts
where counts.spot_id = s.id
  and s.likes_count is distinct from counts.like_count;

update public.spots s
set likes_count = 0
where s.likes_count is distinct from 0
  and not exists (
    select 1
    from public.spot_likes sl
    where sl.spot_id = s.id
  );

alter table public.spot_likes enable row level security;

drop policy if exists "Users can read own spot likes" on public.spot_likes;
create policy "Users can read own spot likes"
  on public.spot_likes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can like spots for themselves" on public.spot_likes;
create policy "Users can like spots for themselves"
  on public.spot_likes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own spot likes" on public.spot_likes;
create policy "Users can remove own spot likes"
  on public.spot_likes
  for delete
  using (auth.uid() = user_id);
