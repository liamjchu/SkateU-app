import { shouldLeaveAuthEntryRoute } from '../authNavigation';

describe('auth entry redirect', () => {
  it('sends a fully set up signed-in user away from login and signup', () => {
    expect(
      shouldLeaveAuthEntryRoute({
        userId: 'user-1',
        legalGate: 'none',
        passwordRecovery: false,
        routeRoot: 'login',
      })
    ).toBe(true);
    expect(
      shouldLeaveAuthEntryRoute({
        userId: 'user-1',
        legalGate: 'none',
        passwordRecovery: false,
        routeRoot: 'signup',
      })
    ).toBe(true);
  });

  it('does not interrupt onboarding, legal acceptance, or password recovery', () => {
    expect(
      shouldLeaveAuthEntryRoute({
        userId: 'user-1',
        legalGate: 'onboarding',
        passwordRecovery: false,
        routeRoot: 'login',
      })
    ).toBe(false);
    expect(
      shouldLeaveAuthEntryRoute({
        userId: 'user-1',
        legalGate: 'none',
        passwordRecovery: true,
        routeRoot: 'login',
      })
    ).toBe(false);
  });

  it('leaves logged-out users on auth screens', () => {
    expect(
      shouldLeaveAuthEntryRoute({
        userId: null,
        legalGate: 'none',
        passwordRecovery: false,
        routeRoot: 'login',
      })
    ).toBe(false);
  });
});
