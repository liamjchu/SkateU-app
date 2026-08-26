import type { Router } from 'expo-router';
import { guardedNavigate } from './navigationGuard';

export function openUserProfile(
  router: Router,
  userId: string,
  currentUserId: string | null
): void {
  guardedNavigate(`user-profile:${userId}`, () => {
    if (currentUserId && userId === currentUserId) {
      router.push('/profile');
      return;
    }

    router.push({
      pathname: '/user/[userId]',
      params: { userId },
    });
  });
}
