-- =============================================================================
-- SkateU — Spot comments, one-level replies, and denormalized comment counts
-- Run after spots_setup.sql and spots_creator_link.sql. Safe to re-run.
-- =============================================================================

-- Keep the count on spots so public spot lists can render it in one query.
alter table public.spots
  add column if not exists comments_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'spots_comments_count_nonnegative'
      and conrelid = 'public.spots'::regclass
  ) then
    alter table public.spots
      add constraint spots_comments_count_nonnegative check (comments_count >= 0);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comments table
--   Top-level comments have parent_comment_id IS NULL.
--   Replies point at a top-level comment on the same spot. Nested replies are
--   rejected by enforce_spot_comment_reply_depth().
--   Deleting a parent cascades to its replies.
--   Deleting a user (and their profile) keeps the comment and clears user_id.
-- -----------------------------------------------------------------------------
create table if not exists public.spot_comments (
  id                 uuid primary key default gen_random_uuid(),
  spot_id            uuid not null references public.spots (id) on delete cascade,
  user_id            uuid references public.profiles (id) on delete set null,
  parent_comment_id  uuid references public.spot_comments (id) on delete cascade,
  content            text not null check (char_length(content) between 1 and 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (parent_comment_id is null or parent_comment_id <> id)
);

create index if not exists spot_comments_spot_id_created_at_idx
  on public.spot_comments (spot_id, created_at desc)
  where parent_comment_id is null;

create index if not exists spot_comments_parent_created_at_idx
  on public.spot_comments (parent_comment_id, created_at asc)
  where parent_comment_id is not null;

create index if not exists spot_comments_user_id_idx
  on public.spot_comments (user_id);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_spot_comments_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists spot_comments_set_updated_at on public.spot_comments;
create trigger spot_comments_set_updated_at
  before update on public.spot_comments
  for each row execute function public.set_spot_comments_updated_at();

-- -----------------------------------------------------------------------------
-- One-level replies: a parent must exist, belong to the same spot, and itself
-- be a top-level comment.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_spot_comment_reply_depth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_parent uuid;
  parent_spot uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if new.parent_comment_id = new.id then
    raise exception 'A comment cannot reply to itself.';
  end if;

  select c.parent_comment_id, c.spot_id
    into parent_parent, parent_spot
    from public.spot_comments c
   where c.id = new.parent_comment_id;

  if not found then
    raise exception 'That comment is no longer here.';
  end if;

  if parent_parent is not null then
    raise exception 'Replies can only be one level deep.';
  end if;

  if parent_spot is distinct from new.spot_id then
    raise exception 'Replies must belong to the same spot.';
  end if;

  return new;
end;
$$;

drop trigger if exists spot_comments_enforce_reply_depth on public.spot_comments;
create trigger spot_comments_enforce_reply_depth
  before insert or update on public.spot_comments
  for each row execute function public.enforce_spot_comment_reply_depth();

-- -----------------------------------------------------------------------------
-- Denormalized comments_count (top-level + replies)
-- -----------------------------------------------------------------------------
create or replace function public.sync_spot_comments_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.spots
      set comments_count = comments_count + 1
      where id = new.spot_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.spots
      set comments_count = greatest(comments_count - 1, 0)
      where id = old.spot_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists spot_comments_increment_count on public.spot_comments;
create trigger spot_comments_increment_count
after insert on public.spot_comments
for each row execute function public.sync_spot_comments_count();

drop trigger if exists spot_comments_decrement_count on public.spot_comments;
create trigger spot_comments_decrement_count
after delete on public.spot_comments
for each row execute function public.sync_spot_comments_count();

-- Repair counts for spots that existed before this feature was installed.
update public.spots s
set comments_count = counts.comment_count
from (
  select spot_id, count(*)::int as comment_count
  from public.spot_comments
  group by spot_id
) counts
where counts.spot_id = s.id
  and s.comments_count is distinct from counts.comment_count;

update public.spots s
set comments_count = 0
where s.comments_count is distinct from 0
  and not exists (
    select 1
    from public.spot_comments sc
    where sc.spot_id = s.id
  );

-- -----------------------------------------------------------------------------
-- Row Level Security
--   Public read (comments are as public as spots).
--   Inserts and deletes are owner-only, keyed on auth.uid().
--   Server routes use the service-role key (bypasses RLS) and MUST set user_id
--   from the verified token. There is no UPDATE policy: comments are not edited.
-- -----------------------------------------------------------------------------
alter table public.spot_comments enable row level security;

drop policy if exists "Spot comments are publicly readable" on public.spot_comments;
create policy "Spot comments are publicly readable"
  on public.spot_comments
  for select
  using (true);

drop policy if exists "Users can insert own spot comments" on public.spot_comments;
create policy "Users can insert own spot comments"
  on public.spot_comments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own spot comments" on public.spot_comments;
create policy "Users can delete own spot comments"
  on public.spot_comments
  for delete
  using (auth.uid() = user_id);
