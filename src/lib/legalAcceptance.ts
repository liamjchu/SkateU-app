import { LEGAL_VERSION } from '../content/legal';
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
  'id, username, avatar_url, bio, updated_at';

export const PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO =
  'id, username, avatar_url, updated_at';

export const PROFILE_LEGAL_TABLE_COLUMNS =
  'id, legal_version, legal_accepted_at, age_attested_at';

export type LegalGate = 'none' | 'age-gate' | 'onboarding' | 'accept-legal';

export function hasAgeAttestation(
  profile: Pick<Profile, 'age_attested_at'> | null
): boolean {
  return (
    typeof profile?.age_attested_at === 'string' &&
    profile.age_attested_at.length > 0
  );
}

export function hasCurrentLegalAcceptance(
  profile: Pick<
    Profile,
    'legal_version' | 'legal_accepted_at' | 'age_attested_at'
  > | null
): boolean {
  return (
    profile?.legal_version === LEGAL_VERSION &&
    typeof profile.legal_accepted_at === 'string' &&
    profile.legal_accepted_at.length > 0 &&
    typeof profile.age_attested_at === 'string' &&
    profile.age_attested_at.length > 0
  );
}

export function getLegalGate(args: {
  userId: string | null;
  profileLoaded: boolean;
  profile: Profile | null;
  confirmedAgeEligibleThisSession: boolean;
}): LegalGate {
  if (!args.userId || !args.profileLoaded) {
    return 'none';
  }

  if (!args.profile?.username) {
    if (
      !hasAgeAttestation(args.profile) &&
      !args.confirmedAgeEligibleThisSession
    ) {
      return 'age-gate';
    }

    return 'onboarding';
  }

  if (!hasCurrentLegalAcceptance(args.profile)) {
    return 'accept-legal';
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

  if (gate === 'onboarding') {
    return routeRoot === 'onboarding';
  }

  return (
    routeRoot === 'accept-legal' || routeRoot === 'verify-delete-account'
  );
}

export function legalGateRedirectPath(
  gate: LegalGate
): '/age-gate' | '/onboarding' | '/accept-legal' | null {
  if (gate === 'age-gate') {
    return '/age-gate';
  }

  if (gate === 'onboarding') {
    return '/onboarding';
  }

  if (gate === 'accept-legal') {
    return '/accept-legal';
  }

  return null;
}

export function isSettledLegalRoute(
  gate: LegalGate,
  routeRoot: string | undefined
): boolean {
  if (gate === 'none') {
    return routeRoot !== 'onboarding' && routeRoot !== 'accept-legal';
  }

  return isAllowedDuringLegalGate(gate, routeRoot);
}
