import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import {
  captureOauthAuthCompleted,
} from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthNoticeStore } from '../store/authNoticeStore';
import { useAuthStore } from '../store/authStore';
import FeedbackPressable from './FeedbackPressable';

// Lets the in-app browser finish any pending auth session when the app is
// brought back to the foreground. Safe to call at module load.
WebBrowser.maybeCompleteAuthSession();

type GoogleSignInButtonProps = {
  // Called after a successful sign in so the screen can navigate away.
  onSuccess?: () => void;
  // Called with a friendly message when sign in fails.
  onError?: (message: string) => void;
  // Lets a parent disable the button (e.g. while an email login is running).
  disabled?: boolean;
  // Compact side-by-side pills on iOS; full-width stacked buttons elsewhere.
  compact?: boolean;
};

export default function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
  compact = false,
}: GoogleSignInButtonProps) {
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const showAuthNotice = useAuthNoticeStore((state) => state.showAuthNotice);
  // Local loading state keeps the button disabled while the browser sheet is
  // open, which stops users from opening multiple OAuth sessions by multi-tapping.
  const [loading, setLoading] = useState(false);

  const isDisabled = disabled || loading;

  const handlePress = async () => {
    if (isDisabled) {
      return;
    }

    setLoading(true);

    try {
      const signedIn = await signInWithGoogle();
      // Only navigate away on a completed sign in. A dismissed/cancelled OAuth
      // sheet resolves false and should just re-enable the button.
      if (!signedIn) {
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const message = 'Could not log in with Google. Please try again.';
        showAuthNotice({ kind: 'error', message });
        onError?.(message);
        return;
      }

      captureOauthAuthCompleted(data.session.user.created_at, 'google');
      showAuthNotice({ kind: 'success' });
      onSuccess?.();
    } catch (error) {
      const message = toUserFacingError(
        error,
        'Could not log in with Google. Please try again.'
      );
      showAuthNotice({ kind: 'error', message });
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeedbackPressable
      haptic="light"
      onPress={handlePress}
      disabled={isDisabled}
      className={`min-h-12 flex-row items-center justify-center gap-2 border border-border-soft bg-white ${
        compact ? 'flex-1 rounded-xl py-3' : 'rounded-2xl py-4'
      } ${isDisabled ? 'opacity-60' : ''}`}
      accessibilityLabel="Sign in with Google"
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <View className="flex-row items-center gap-2">
          <Ionicons name="logo-google" size={20} color={colors.brand} />
          <Text className="text-base text-brand font-outfit-bold">
            {compact ? 'Google' : 'Sign in with Google'}
          </Text>
        </View>
      )}
    </FeedbackPressable>
  );
}
