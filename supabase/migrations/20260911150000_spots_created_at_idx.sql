-- Fast newest-first candidate fetch for the ranked home/feed list.
create index if not exists spots_created_at_idx
  on public.spots (created_at desc);
