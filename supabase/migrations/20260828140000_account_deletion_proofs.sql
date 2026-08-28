-- Short-lived, single-use proofs required before the API can delete an account.
-- This table is server-only: the service-role key creates and consumes proofs.

create table if not exists public.account_deletion_proofs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  proof_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_proofs enable row level security;

revoke all on table public.account_deletion_proofs from public;
revoke all on table public.account_deletion_proofs from anon;
revoke all on table public.account_deletion_proofs from authenticated;
grant all on table public.account_deletion_proofs to service_role;
