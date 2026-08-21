import {
  canStartGuardedAction,
  guardedNavigate,
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

  it('allows a different destination while another navigation is in flight', () => {
    const navigate = jest.fn();
    expect(guardedNavigate('map:school-1', navigate)).toBe(true);
    expect(guardedNavigate('map:school-2', navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('expires the lock after the window', () => {
    expect(canStartGuardedAction('login', 1_000, 800)).toBe(true);
    expect(canStartGuardedAction('login', 1_500, 800)).toBe(false);
    expect(canStartGuardedAction('login', 1_900, 800)).toBe(true);
  });
});
