-- =============================================================================
-- SkateU — User feedback (contact, bug reports, feature ideas, spot problems)
-- Run this in the Supabase SQL Editor AFTER spots_setup.sql and
-- spot_removal_requests_setup.sql. Safe to re-run.
--
-- This is NOT the spot-removal moderation queue. Removal requests stay in
-- public.spot_removal_requests.
--
-- Inbox (SQL editor / service role only):
--   select * from public.user_feedback order by created_at desc;
--
-- STORAGE PREREQUISITE (one-time, not part of this SQL):
--   Create a PRIVATE Storage bucket named `feedback-attachments`.
--     * Dashboard → Storage → New bucket → name `feedback-attachments`,
--       "Public bucket" OFF.
--     * Or via the Storage API:
--         POST {SUPABASE_URL}/storage/v1/bucket
--         Authorization: Bearer <service-role key>
--         { "id": "feedback-attachments", "name": "feedback-attachments", "public": false }
--   Uploads and signed URLs are performed by server routes with the
--   service-role key. Clients must not upload or list this bucket.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. user_feedback
-- -----------------------------------------------------------------------------
create table if not exists public.user_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  type            text not null,
  category        text,
  spot_id         uuid references public.spots (id) on delete set null,
  message         text not null default '',
  contact_email   text not null default '',
  attachment_path text,
  metadata        jsonb not null default '{}'::jsonb,
  status          text not null default 'new',
  created_at      timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_feedback_type_valid'
      and conrelid = 'public.user_feedback'::regclass
  ) then
    alter table public.user_feedback
      add constraint user_feedback_type_valid
      check (type in ('contact', 'bug', 'feature', 'spot_problem'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_feedback_status_valid'
      and conrelid = 'public.user_feedback'::regclass
  ) then
    alter table public.user_feedback
      add constraint user_feedback_status_valid
      check (status in ('new', 'investigating', 'fixed', 'wont_fix'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_feedback_category_matches_type'
      and conrelid = 'public.user_feedback'::regclass
  ) then
    alter table public.user_feedback
      add constraint user_feedback_category_matches_type
      check (
        (type = 'contact' and category in (
          'general', 'feedback', 'partnership', 'press', 'business', 'other'
        ))
        or (type = 'spot_problem' and category in (
          'incorrect_location',
          'incorrect_information',
          'incorrect_photo',
          'spot_changed',
          'other'
        ))
        or (type in ('bug', 'feature') and category is null)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_feedback_message_length'
      and conrelid = 'public.user_feedback'::regclass
  ) then
    alter table public.user_feedback
      add constraint user_feedback_message_length
      check (
        (type in ('contact', 'bug', 'feature')
          and char_length(message) between 1 and 2000)
        or (type = 'spot_problem' and char_length(message) <= 500)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_feedback_contact_email_length'
      and conrelid = 'public.user_feedback'::regclass
  ) then
    alter table public.user_feedback
      add constraint user_feedback_contact_email_length
      check (char_length(contact_email) <= 254);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_feedback_spot_problem_requires_spot'
      and conrelid = 'public.user_feedback'::regclass
  ) then
    alter table public.user_feedback
      add constraint user_feedback_spot_problem_requires_spot
      check (type <> 'spot_problem' or spot_id is not null);
  end if;
end;
$$;

create index if not exists user_feedback_user_id_created_at_idx
  on public.user_feedback (user_id, created_at desc);

create index if not exists user_feedback_type_status_created_at_idx
  on public.user_feedback (type, status, created_at desc);

create index if not exists user_feedback_spot_id_idx
  on public.user_feedback (spot_id);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
--    Clients may insert/read their own rows with status = 'new'. The API uses
--    the service-role key and always sets user_id from the verified token.
--    No update or delete policies — rows are immutable from the client.
-- -----------------------------------------------------------------------------
alter table public.user_feedback enable row level security;

drop policy if exists "Users can read own feedback"
  on public.user_feedback;
create policy "Users can read own feedback"
  on public.user_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback"
  on public.user_feedback;
create policy "Users can insert own feedback"
  on public.user_feedback
  for insert
  with check (
    auth.uid() = user_id
    and status = 'new'
  );

-- -----------------------------------------------------------------------------
-- 3. Clients must not change feedback rows (status, identity, metadata, etc.).
--    Service-role SQL in the dashboard can still update status.
-- -----------------------------------------------------------------------------
create or replace function public.protect_user_feedback_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'User feedback cannot be changed by clients';
  end if;
  return new;
end;
$$;

drop trigger if exists user_feedback_protect_columns on public.user_feedback;
create trigger user_feedback_protect_columns
  before update on public.user_feedback
  for each row execute function public.protect_user_feedback_columns();
