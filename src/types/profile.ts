// A row from public.profiles. `username` is null until the user finishes
// onboarding, which is exactly the signal our navigation gate keys off of.
export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  updated_at: string | null;
};
