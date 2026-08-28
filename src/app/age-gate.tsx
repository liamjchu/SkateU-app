import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

export default function AgeGateScreen() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const username = useProfileStore((state) => state.profile?.username ?? null);

  useEffect(() => {
    const next =
      userId && !username ? '/onboarding' : userId ? '/' : '/signup';
    router.replace(next);
  }, [router, userId, username]);

  return null;
}
