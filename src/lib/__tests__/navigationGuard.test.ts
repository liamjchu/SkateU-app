import {
  canStartGuardedAction,
  guardedNavigate,
  hrefKey,
  releaseNavigationLock,
  resetNavigationGuard,
} from '../navigationGuard';

describe('navigation guard', () => {
  beforeEach(() => {
    resetNavigationGuard();
  });

  it('allows the first navigation and blocks a duplicate key', () => {
    const navigate = jest.fn();
    expect(guardedNavigate('map:school-1', navigate)).toBe(true);
    expect(guardedNavigate('map:school-1', navigate)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('blocks a different destination while another navigation is in flight', () => {
    const navigate = jest.fn();
    expect(guardedNavigate('map:school-1', navigate)).toBe(true);
    expect(guardedNavigate('profile', navigate)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('allows another destination after the lock is released', () => {
    const navigate = jest.fn();
    expect(guardedNavigate('map:school-1', navigate)).toBe(true);
    releaseNavigationLock();
    expect(guardedNavigate('profile', navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('runs nested navigate calls in the same turn', () => {
    const inner = jest.fn();
    const outer = jest.fn(() => {
      guardedNavigate('inner', inner);
    });
    expect(guardedNavigate('outer', outer)).toBe(true);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('expires the lock after the window', () => {
    expect(canStartGuardedAction('login', 1_000, 800)).toBe(true);
    expect(canStartGuardedAction('login', 1_500, 800)).toBe(false);
    expect(canStartGuardedAction('login', 1_900, 800)).toBe(true);
  });

  it('keys string and object hrefs by pathname', () => {
    expect(hrefKey('/map?lat=1')).toBe('/map');
    expect(hrefKey({ pathname: '/map', params: { schoolId: '1' } })).toBe(
      '/map'
    );
    expect(hrefKey({} as never)).toBe('unknown');
    expect(hrefKey({ pathname: '' } as never)).toBe('unknown');
  });

  it('lets back skip the global lock', () => {
    const navigate = jest.fn();
    expect(guardedNavigate('map', navigate)).toBe(true);
    expect(
      guardedNavigate('back', navigate, 800, { useGlobalLock: false })
    ).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('extends the global lock when a duplicate push is blocked', () => {
    const navigate = jest.fn();
    expect(guardedNavigate('map', navigate)).toBe(true);
    expect(guardedNavigate('profile', navigate)).toBe(false);
    releaseNavigationLock();
    expect(guardedNavigate('profile', navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
