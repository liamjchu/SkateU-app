import { LEGAL_VERSION } from '../../content/legal';
import type { Profile } from '../../types/profile';
import { canCreateAccountAtAge } from '../ageEligibility';
import {
  LEGAL_APP_ROUTES,
  PROFILE_PUBLIC_SELECT_COLUMNS,
  PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO,
  canAcceptLegalTerms,
  getLegalGate,
  hasCurrentLegalAcceptance,
  isAllowedDuringLegalGate,
  isSettledLegalRoute,
  legalGateRedirectPath,
} from '../legalAcceptance';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    username: 'liam',
    avatar_url: null,
    bio: null,
    updated_at: '2026-08-20T00:00:00.000Z',
    legal_version: LEGAL_VERSION,
    legal_accepted_at: '2026-08-20T00:00:00.000Z',
    age_attested_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('account acceptance', () => {
  it('cannot continue without the required agreement', () => {
    expect(canAcceptLegalTerms(false)).toBe(false);
    expect(canAcceptLegalTerms(true)).toBe(true);
  });

  it('exposes in-app legal routes for login, settings, and the acceptance checkbox', () => {
    expect(LEGAL_APP_ROUTES).toEqual({
      terms: '/legal/terms',
      privacy: '/legal/privacy',
      communityGuidelines: '/legal/community-guidelines',
    });
  });

  it('does not let public profile selects read legal timestamps', () => {
    expect(PROFILE_PUBLIC_SELECT_COLUMNS).toBe(
      'id, username, avatar_url, bio, updated_at'
    );
    expect(PROFILE_PUBLIC_SELECT_COLUMNS_WITHOUT_BIO).toBe(
      'id, username, avatar_url, updated_at'
    );
    expect(PROFILE_PUBLIC_SELECT_COLUMNS).not.toMatch(/legal_version|age_attested_at/);
  });
});

describe('age eligibility', () => {
  it('only allows account creation when the person is 13 or older', () => {
    expect(canCreateAccountAtAge(false)).toBe(false);
    expect(canCreateAccountAtAge(true)).toBe(true);
  });
});

describe('hasCurrentLegalAcceptance', () => {
  it('requires the current version and both timestamps', () => {
    expect(hasCurrentLegalAcceptance(profile())).toBe(true);
    expect(
      hasCurrentLegalAcceptance(profile({ legal_version: '2019-01-01' }))
    ).toBe(false);
    expect(hasCurrentLegalAcceptance(profile({ legal_accepted_at: null }))).toBe(
      false
    );
    expect(hasCurrentLegalAcceptance(profile({ age_attested_at: null }))).toBe(
      false
    );
    expect(hasCurrentLegalAcceptance(null)).toBe(false);
  });
});

describe('getLegalGate', () => {
  it('does not gate logged-out users or unresolved profiles', () => {
    expect(
      getLegalGate({
        userId: null,
        profileLoaded: true,
        profile: null,
        confirmedAgeEligibleThisSession: false,
      })
    ).toBe('none');
    expect(
      getLegalGate({
        userId: 'user-1',
        profileLoaded: false,
        profile: null,
        confirmedAgeEligibleThisSession: false,
      })
    ).toBe('none');
  });

  it('sends signed-in users without a username to the age gate first', () => {
    expect(
      getLegalGate({
        userId: 'user-1',
        profileLoaded: true,
        profile: profile({
          username: null,
          legal_version: null,
          legal_accepted_at: null,
          age_attested_at: null,
        }),
        confirmedAgeEligibleThisSession: false,
      })
    ).toBe('age-gate');
  });

  it('sends incomplete accounts to onboarding after a 13+ confirmation', () => {
    expect(
      getLegalGate({
        userId: 'user-1',
        profileLoaded: true,
        profile: profile({
          username: null,
          legal_version: null,
          legal_accepted_at: null,
          age_attested_at: null,
        }),
        confirmedAgeEligibleThisSession: true,
      })
    ).toBe('onboarding');
    expect(
      getLegalGate({
        userId: 'user-1',
        profileLoaded: true,
        profile: profile({
          username: null,
          legal_version: null,
          legal_accepted_at: null,
        }),
        confirmedAgeEligibleThisSession: false,
      })
    ).toBe('onboarding');
  });

  it('sends existing users with a username to accept-legal until they accept', () => {
    expect(
      getLegalGate({
        userId: 'user-1',
        profileLoaded: true,
        profile: profile({
          legal_version: null,
          legal_accepted_at: null,
          age_attested_at: null,
        }),
        confirmedAgeEligibleThisSession: false,
      })
    ).toBe('accept-legal');
  });

  it('lets users through after current acceptance', () => {
    expect(
      getLegalGate({
        userId: 'user-1',
        profileLoaded: true,
        profile: profile(),
        confirmedAgeEligibleThisSession: false,
      })
    ).toBe('none');
  });
});

describe('legal route lock', () => {
  it('keeps legal documents reachable while gated and blocks the rest of the app', () => {
    expect(isAllowedDuringLegalGate('age-gate', 'age-gate')).toBe(true);
    expect(isAllowedDuringLegalGate('age-gate', 'age-restricted')).toBe(true);
    expect(isAllowedDuringLegalGate('age-gate', 'onboarding')).toBe(false);
    expect(isAllowedDuringLegalGate('onboarding', 'legal')).toBe(true);
    expect(isAllowedDuringLegalGate('onboarding', 'onboarding')).toBe(true);
    expect(isAllowedDuringLegalGate('onboarding', 'index')).toBe(false);
    expect(isAllowedDuringLegalGate('accept-legal', 'legal')).toBe(true);
    expect(isAllowedDuringLegalGate('accept-legal', 'verify-delete-account')).toBe(
      true
    );
    expect(isAllowedDuringLegalGate('accept-legal', 'settings')).toBe(false);
    expect(legalGateRedirectPath('age-gate')).toBe('/age-gate');
    expect(legalGateRedirectPath('onboarding')).toBe('/onboarding');
    expect(legalGateRedirectPath('accept-legal')).toBe('/accept-legal');
    expect(legalGateRedirectPath('none')).toBeNull();
  });

  it('does not treat the app as settled if a required gate is skipped', () => {
    expect(isSettledLegalRoute('age-gate', 'index')).toBe(false);
    expect(isSettledLegalRoute('age-gate', 'age-gate')).toBe(true);
    expect(isSettledLegalRoute('onboarding', 'index')).toBe(false);
    expect(isSettledLegalRoute('onboarding', 'onboarding')).toBe(true);
    expect(isSettledLegalRoute('onboarding', 'legal')).toBe(true);
    expect(isSettledLegalRoute('accept-legal', 'index')).toBe(false);
    expect(isSettledLegalRoute('accept-legal', 'accept-legal')).toBe(true);
    expect(isSettledLegalRoute('none', 'index')).toBe(true);
    expect(isSettledLegalRoute('none', 'legal')).toBe(true);
    expect(isSettledLegalRoute('none', 'age-gate')).toBe(true);
    expect(isSettledLegalRoute('none', 'onboarding')).toBe(false);
    expect(isSettledLegalRoute('none', 'accept-legal')).toBe(false);
  });
});
