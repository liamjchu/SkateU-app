-- Optional public profile bio. Written only by the moderated server route.

alter table public.profiles
  add column if not exists bio text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_bio_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_bio_length_check
      check (bio is null or char_length(bio) <= 160);
  end if;
end;
$$;

create or replace function public.profile_bio_is_unchanged(
  profile_id uuid,
  candidate_bio text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select existing.bio is not distinct from candidate_bio
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
    and public.profile_bio_is_unchanged(id, bio)
  );
