import { resetNavigationGuard } from '../navigationGuard';
import { openUserProfile } from '../userProfileNavigation';

describe('openUserProfile', () => {
  beforeEach(() => {
    resetNavigationGuard();
  });

  it('opens the signed-in user’s own profile screen', () => {
    const router = { push: jest.fn() };
    openUserProfile(router as never, 'user-1', 'user-1');
    expect(router.push).toHaveBeenCalledWith('/profile');
  });

  it('opens another skater’s public profile', () => {
    const router = { push: jest.fn() };
    openUserProfile(router as never, 'user-2', 'user-1');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/user/[userId]',
      params: { userId: 'user-2' },
    });
  });

  it('opens a public profile when nobody is signed in', () => {
    const router = { push: jest.fn() };
    openUserProfile(router as never, 'user-2', null);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/user/[userId]',
      params: { userId: 'user-2' },
    });
  });
});
