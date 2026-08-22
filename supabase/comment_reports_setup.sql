-- =============================================================================
-- SkateU — Comment reports
-- Run after spot_comments_setup.sql. Safe to re-run.
--
-- Signed-in users can report a comment. One report per user per comment.
-- The API uses the service-role key and emails MODERATION_NOTIFY_EMAIL.
--
-- Inbox:
--   select * from public.comment_reports order by created_at desc;
-- =============================================================================

create table if not exists public.comment_reports (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.spot_comments (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null,
  details     text not null default '' check (char_length(details) <= 500),
  created_at  timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comment_reports_reason_valid'
      and conrelid = 'public.comment_reports'::regclass
  ) then
    alter table public.comment_reports
      add constraint comment_reports_reason_valid
      check (reason in (
        'harassment',
        'hate',
        'sexual',
        'spam',
        'other'
      ));
  end if;
end;
$$;

create index if not exists comment_reports_comment_id_idx
  on public.comment_reports (comment_id);

create index if not exists comment_reports_reporter_id_created_at_idx
  on public.comment_reports (reporter_id, created_at desc);

alter table public.comment_reports enable row level security;

revoke all on table public.comment_reports from public;
revoke all on table public.comment_reports from anon;
revoke all on table public.comment_reports from authenticated;
grant all on table public.comment_reports to service_role;
