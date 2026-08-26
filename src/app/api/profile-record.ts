import { LEGAL_VERSION } from '../../content/legal';
import type { Profile } from '../../types/profile';
import { mapProfile } from '../../types/profile';
import {
  PROFILE_LEGAL_TABLE_COLUMNS,
  PROFILE_PUBLIC_SELECT_COLUMNS,
  PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO,
} from '../../lib/legalAcceptance';
import { getSupabaseConfig } from './spots+api';

type SupabaseConfig = NonNullable<ReturnType<typeof getSupabaseConfig>>;

type PublicProfileRow = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  updated_at?: string | null;
};

type LegalRow = {
  id?: string;
  legal_version?: string | null;
  legal_accepted_at?: string | null;
  age_attested_at?: string | null;
};

function isPublicProfileRow(value: unknown): value is PublicProfileRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Partial<PublicProfileRow>;
  return typeof row.id === 'string' && row.id.length > 0;
}

function firstRow(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : null;
}

function asLegalRow(value: unknown): LegalRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as LegalRow;
}

function supabaseRestHeaders(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
  };
}

function isMissingBioColumn(status: number, body: string): boolean {
  return status === 400 && body.includes('profiles.bio does not exist');
}

async function fetchLegalRowFromProfiles(
  config: SupabaseConfig,
  userId: string,
  signal?: AbortSignal
): Promise<LegalRow | null> {
  const select = encodeURIComponent(PROFILE_LEGAL_TABLE_COLUMNS);
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=${select}`,
    {
      headers: supabaseRestHeaders(config),
      signal,
    }
  );

  if (response.ok) {
    return asLegalRow(firstRow((await response.json()) as unknown));
  }

  // Missing columns (PGRST204) means legal acceptance has not been migrated yet.
  if (response.status === 400) {
    return null;
  }

  throw new Error(`Legal lookup failed: ${response.status}`);
}

async function fetchPublicProfileWithSelect(
  config: SupabaseConfig,
  userId: string,
  selectColumns: string,
  signal?: AbortSignal
): Promise<{ ok: true; row: PublicProfileRow | null } | { ok: false; status: number; body: string }> {
  const select = encodeURIComponent(selectColumns);
  const response = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=${select}`,
    {
      headers: supabaseRestHeaders(config),
      signal,
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { ok: false, status: response.status, body };
  }

  const rows = (await response.json()) as unknown;
  const row = firstRow(rows);
  return { ok: true, row: isPublicProfileRow(row) ? row : null };
}

export async function fetchPublicProfile(
  config: SupabaseConfig,
  userId: string,
  signal?: AbortSignal
): Promise<PublicProfileRow | null> {
  const primary = await fetchPublicProfileWithSelect(
    config,
    userId,
    PROFILE_PUBLIC_SELECT_COLUMNS,
    signal
  );

  if (primary.ok) {
    return primary.row;
  }

  if (isMissingBioColumn(primary.status, primary.body)) {
    const fallback = await fetchPublicProfileWithSelect(
      config,
      userId,
      PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO,
      signal
    );
    if (fallback.ok) {
      return fallback.row;
    }

    throw new Error(`Profile lookup failed: ${fallback.status}`);
  }

  throw new Error(`Profile lookup failed: ${primary.status}`);
}

export async function fetchLegalRow(
  config: SupabaseConfig,
  userId: string,
  signal?: AbortSignal
): Promise<LegalRow | null> {
  const select = encodeURIComponent(PROFILE_LEGAL_TABLE_COLUMNS);
  const response = await fetch(
    `${config.url}/rest/v1/profile_legal?id=eq.${encodeURIComponent(userId)}&select=${select}`,
    {
      headers: supabaseRestHeaders(config),
      signal,
    }
  );

  if (response.ok) {
    return asLegalRow(firstRow((await response.json()) as unknown));
  }

  if (response.status === 404) {
    return fetchLegalRowFromProfiles(config, userId, signal);
  }

  throw new Error(`Legal lookup failed: ${response.status}`);
}

export function mergeProfileRecord(
  profile: PublicProfileRow,
  legal: LegalRow | null
): Profile {
  return mapProfile({
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    updated_at: profile.updated_at,
    legal_version: legal?.legal_version ?? null,
    legal_accepted_at: legal?.legal_accepted_at ?? null,
    age_attested_at: legal?.age_attested_at ?? null,
  });
}

export async function fetchMergedProfile(
  config: SupabaseConfig,
  userId: string,
  signal?: AbortSignal
): Promise<Profile | null> {
  const [profile, legal] = await Promise.all([
    fetchPublicProfile(config, userId, signal),
    fetchLegalRow(config, userId, signal),
  ]);

  if (!profile) {
    return null;
  }

  return mergeProfileRecord(profile, legal);
}

export async function upsertProfileLegal(
  config: SupabaseConfig,
  userId: string,
  acceptedAt: string,
  signal?: AbortSignal
): Promise<Profile | null> {
  const response = await fetch(
    `${config.url}/rest/v1/profile_legal?on_conflict=id`,
    {
      method: 'POST',
      headers: {
        ...supabaseRestHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: userId,
        legal_version: LEGAL_VERSION,
        legal_accepted_at: acceptedAt,
        age_attested_at: acceptedAt,
      }),
      signal,
    }
  );

  if (response.ok) {
    return fetchMergedProfile(config, userId, signal);
  }

  if (response.status !== 404) {
    throw new Error(`Legal upsert failed: ${response.status}`);
  }

  const fallback = await fetch(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseRestHeaders(config),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        legal_version: LEGAL_VERSION,
        legal_accepted_at: acceptedAt,
        age_attested_at: acceptedAt,
      }),
      signal,
    }
  );

  if (!fallback.ok) {
    throw new Error(`Legal upsert failed: ${fallback.status}`);
  }

  return fetchMergedProfile(config, userId, signal);
}
