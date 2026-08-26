-- Store proposed edits off the live columns until background AI review finishes.
-- The public pin stays on the map with the current name, photos, and location.

alter table public.spots
  add column if not exists pending_edit jsonb;
