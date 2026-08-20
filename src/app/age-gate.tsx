import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import AgeGatePrompt from '../components/age-gate-prompt';
import FeedbackPressable from '../components/FeedbackPressable';
import { canCreateAccountAtAge } from '../lib/ageEligibility';
import { getApiUrl } from '../lib/api';
import { toUserFacingError } from '../lib/userFacingError';
import { useAgeEligibilityStore } from '../store/ageEligibilityStore';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

export default function AgeGateScreen() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const signOut = useAuthStore((state) => state.signOut);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const markEligible = useAgeEligibilityStore((state) => state.markEligible);
  const clearEligible = useAgeEligibilityStore((state) => state.clear);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleYes = () => {
    if (submitting) {
      return;
    }

    if (!canCreateAccountAtAge(true)) {
      return;
    }

    markEligible();

    if (userId) {
      router.replace('/onboarding');
      return;
    }

    router.replace('/signup');
  };

  const handleNo = async () => {
    if (submitting) {
      return;
    }

    if (!userId || !accessToken) {
      clearEligible();
      router.replace('/age-restricted');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(getApiUrl('/api/abandon-underage-account'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error ?? 'Could not close that account. Try again.'
        );
      }

      clearEligible();
      clearProfile();
      await signOut();
      router.replace('/age-restricted');
    } catch (submitError) {
      setError(
        toUserFacingError(
          submitError,
          'Could not close that account. Try again.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (submitting) {
      return;
    }

    try {
      clearEligible();
      clearProfile();
      await signOut();
      router.replace('/');
    } catch {
      // The auth listener will settle state if sign-out cannot complete here.
    }
  };

  return (
    <AgeGatePrompt
      onYes={handleYes}
      onNo={() => void handleNo()}
      yesDisabled={submitting}
      noDisabled={submitting}
      footer={
        <>
          {error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-3 font-outfit-medium text-sm text-errorText"
            >
              {error}
            </Text>
          ) : null}
          {userId ? (
            <FeedbackPressable
              onPress={() => void handleSignOut()}
              disabled={submitting}
              className="mt-8 min-h-12 items-center justify-center py-4"
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text className="font-outfit-semibold text-base text-muted">
                Sign out
              </Text>
            </FeedbackPressable>
          ) : null}
        </>
      }
    />
  );
}
