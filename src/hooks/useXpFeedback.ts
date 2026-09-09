import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { triggerHaptic } from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useXpFeedbackStore } from '../store/xpFeedbackStore';

export function useXpFeedback() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);
  const fetchProfile = useProfileStore((state) => state.fetchProfile);
  const xpTotal = useProfileStore((state) => state.profile?.xp_total ?? null);
  const profileId = useProfileStore((state) => state.profile?.id ?? null);
  const profileHydrated = useProfileStore((state) => state.hasHydrated);
  const xpHydrated = useXpFeedbackStore((state) => state.hasHydrated);
  const applyXpSnapshot = useXpFeedbackStore((state) => state.applyXpSnapshot);
  const toast = useXpFeedbackStore((state) => state.toast);
  const rankUp = useXpFeedbackStore((state) => state.rankUp);

  useEffect(() => {
    if (!profileHydrated || !xpHydrated || !userId || profileId !== userId) {
      return;
    }
    if (xpTotal === null) {
      return;
    }
    applyXpSnapshot(userId, xpTotal);
  }, [
    applyXpSnapshot,
    profileHydrated,
    profileId,
    userId,
    xpHydrated,
    xpTotal,
  ]);

  useEffect(() => {
    if (toast || rankUp) {
      triggerHaptic('success');
    }
  }, [rankUp, toast]);

  useEffect(() => {
    if (!userId || !accessToken) {
      return;
    }

    const onChange = (status: AppStateStatus) => {
      if (status === 'active') {
        void fetchProfile(userId, accessToken);
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
    };
  }, [accessToken, fetchProfile, userId]);
}
