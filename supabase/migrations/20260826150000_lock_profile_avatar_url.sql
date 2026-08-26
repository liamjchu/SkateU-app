-- Profile photos are written only by the moderated server route.
-- Direct client updates must not change avatar_url.
--
-- Recreate the username helper here: it originally lived only in
-- profiles_setup.sql, so databases that apply numbered migrations can miss it.

create or replace function public.profile_username_is_unchanged(
  profile_id uuid,
  candidate_username text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select existing.username is not distinct from candidate_username
  from public.profiles as existing
  where existing.id = profile_id;
$$;

create or replace function public.profile_avatar_url_is_unchanged(
  profile_id uuid,
  candidate_avatar_url text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select existing.avatar_url is not distinct from candidate_avatar_url
  from public.profiles as existing
  where existing.id = profile_id;
$$;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and public.profile_username_is_unchanged(id, username)
    and public.profile_avatar_url_is_unchanged(id, avatar_url)
  );
