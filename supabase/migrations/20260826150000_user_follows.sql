-- One-way follow graph. Clients never query this table; APIs use the service role.

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists user_follows_following_id_idx
  on public.user_follows (following_id);

create index if not exists user_follows_follower_id_idx
  on public.user_follows (follower_id);

alter table public.user_follows enable row level security;

revoke all on table public.user_follows from public;
revoke all on table public.user_follows from anon;
revoke all on table public.user_follows from authenticated;
grant all on table public.user_follows to service_role;
