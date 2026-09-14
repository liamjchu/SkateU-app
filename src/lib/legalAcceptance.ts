import type { Profile } from '../types/profile';

export const LEGAL_APP_ROUTES = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  communityGuidelines: '/legal/community-guidelines',
} as const;

export function canAcceptLegalTerms(agreed: boolean): boolean {
  return agreed === true;
}

export const PROFILE_PUBLIC_SELECT_COLUMNS =
  'id, username, avatar_url, bio, updated_at, xp_total';

export const PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO =
  'id, username, avatar_url, updated_at, xp_total';

export const PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_XP =
  'id, username, avatar_url, bio, updated_at';

export const PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO_AND_XP =
  'id, username, avatar_url, updated_at';

export const PROFILE_LEGAL_TABLE_COLUMNS =
  'id, legal_version, legal_accepted_at, age_attested_at';

export type LegalGate = 'none' | 'age-gate' | 'onboarding';

const RETIRED_ACCEPT_LEGAL_SEGMENT = 'accept-legal';

function pathSegments(path: string): string[] {
  let pathname = path.trim();
  let hostname = '';

  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathname)) {
      const url = new URL(pathname);
      hostname = url.hostname;
      pathname = url.pathname || pathname;
    }
  } catch {
    // Keep the original string when it is not a parseable URL.
  }

  const segments = pathname
    .split(/[?#]/, 1)[0]
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '--');

  // skateu://accept-legal stores the route in the host, not the path.
  if (
    hostname.length > 0 &&
    !hostname.includes('.') &&
    hostname !== 'localhost'
  ) {
    segments.unshift(hostname);
  }

  return segments;
}

// Old TestFlight/App Store builds and Google OAuth still open /accept-legal.
export function isRetiredAcceptLegalPath(
  path: string | null | undefined
): boolean {
  if (!path) {
    return false;
  }

  const segments = pathSegments(path);
  return segments[segments.length - 1] === RETIRED_ACCEPT_LEGAL_SEGMENT;
}

export function rewriteRetiredAcceptLegalPath(path: string): string {
  if (!isRetiredAcceptLegalPath(path)) {
    return path;
  }

  return '/';
}

export function hasAgeAttestation(
  profile: Pick<Profile, 'age_attested_at'> | null
): boolean {
  return (
    typeof profile?.age_attested_at === 'string' &&
    profile.age_attested_at.length > 0
  );
}

// Used to keep a cached acceptance when a later profile refresh has no legal
// row. The app does not block accounts that already have a username.
export function hasCurrentLegalAcceptance(
  profile: Pick<
    Profile,
    'legal_version' | 'legal_accepted_at' | 'age_attested_at'
  > | null
): boolean {
  return (
    typeof profile?.legal_accepted_at === 'string' &&
    profile.legal_accepted_at.length > 0 &&
    typeof profile.age_attested_at === 'string' &&
    profile.age_attested_at.length > 0
  );
}

export function getLegalGate(args: {
  userId: string | null;
  profileLoaded: boolean;
  profile: Profile | null;
}): LegalGate {
  if (!args.userId || !args.profileLoaded) {
    return 'none';
  }

  if (!args.profile?.username) {
    return 'onboarding';
  }

  return 'none';
}

export function isAllowedDuringLegalGate(
  gate: LegalGate,
  routeRoot: string | undefined
): boolean {
  if (gate === 'none') {
    return true;
  }

  if (routeRoot === 'legal') {
    return true;
  }

  if (gate === 'age-gate') {
    return routeRoot === 'age-gate' || routeRoot === 'age-restricted';
  }

  return routeRoot === 'onboarding' || routeRoot === 'age-gate';
}

export function legalGateRedirectPath(
  gate: LegalGate
): '/age-gate' | '/onboarding' | null {
  if (gate === 'age-gate') {
    return '/age-gate';
  }

  if (gate === 'onboarding') {
    return '/onboarding';
  }

  return null;
}

export function isSettledLegalRoute(
  gate: LegalGate,
  routeRoot: string | undefined
): boolean {
  if (gate === 'none') {
    return routeRoot !== 'onboarding';
  }

  return isAllowedDuringLegalGate(gate, routeRoot);
}
