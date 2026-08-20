// A row from public.profiles. `username` is null until the user finishes
// onboarding, which is exactly the signal our navigation gate keys off of.
export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  legal_version: string | null;
  legal_accepted_at: string | null;
  age_attested_at: string | null;
};

export function readOptionalProfileText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function mapProfile(row: {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
  legal_version?: string | null;
  legal_accepted_at?: string | null;
  age_attested_at?: string | null;
}): Profile {
  return {
    id: row.id,
    username: readOptionalProfileText(row.username),
    avatar_url: readOptionalProfileText(row.avatar_url),
    updated_at: readOptionalProfileText(row.updated_at),
    legal_version: readOptionalProfileText(row.legal_version),
    legal_accepted_at: readOptionalProfileText(row.legal_accepted_at),
    age_attested_at: readOptionalProfileText(row.age_attested_at),
  };
}
