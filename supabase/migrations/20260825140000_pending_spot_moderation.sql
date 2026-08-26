-- Allow new spots to sit off the map until background AI review finishes.

alter table public.spots
  drop constraint if exists spots_status_valid;

alter table public.spots
  add constraint spots_status_valid
  check (status in ('active', 'under_review', 'pending_moderation', 'removed'));

drop policy if exists "Spots are publicly readable" on public.spots;
create policy "Spots are publicly readable"
  on public.spots
  for select
  using (status in ('active', 'under_review'));
