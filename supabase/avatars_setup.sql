-- =============================================================================
-- SkateU — Public `avatars` Storage bucket
-- Run this in the Supabase SQL Editor. Safe to re-run.
--
-- Profile photos are uploaded only by /api/profile-avatar with the service-role
-- key after AI review. Clients must not upload or list this bucket.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');
