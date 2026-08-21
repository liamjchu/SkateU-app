-- =============================================================================
-- SkateU — User blocks
-- Run after profiles_setup.sql. Safe to re-run.
--
-- Signed-in users can hide another skater’s spots and comments. Blocks are
-- one-way. The API uses the service-role key; clients do not query this table.
--
-- Inbox:
--   select * from public.user_blocks order by created_at desc;
-- =============================================================================

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
