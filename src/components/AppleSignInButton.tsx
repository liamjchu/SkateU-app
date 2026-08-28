import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  captureOauthAuthCompleted,
} from '../lib/analytics';
import { signInWithAppleIdentityToken } from '../lib/appleAuthentication';
import { supabase } from '../lib/supabase';
import { toUserFacingError } from '../lib/userFacingError';
import { colors } from '../constants/colors';
import { useAuthNoticeStore } from '../store/authNoticeStore';
import FeedbackPressable from './FeedbackPressable';

type AppleSignInButtonProps = {
  disabled?: boolean;
  onError?: (message: string) => void;
  onSuccess?: () => void;
  compact?: boolean;
};

type AppleAuthenticationError = { code?: string };

function isRequestCanceled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as AppleAuthenticationError).code === 'ERR_REQUEST_CANCELED'
  );
}

function createNonce(): string {
  return Array.from(Crypto.getRandomBytes(32), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export default function AppleSignInButton({
  disabled = false,
  onError,
  onSuccess,
  compact = false,
}: AppleSignInButtonProps) {
  const [available, setAvailable] = useState(process.env.EXPO_OS === 'ios');
  const [loading, setLoading] = useState(false);
  const showAuthNotice = useAuthNoticeStore((state) => state.showAuthNotice);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const isDisabled = disabled || loading;

  const handlePress = async () => {
    if (isDisabled) {
      return;
    }

    setLoading(true);

    try {
      const nonce = createNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token. Please try again.');
      }

      await signInWithAppleIdentityToken({
        identityToken: credential.identityToken,
        user: credential.user,
        nonce,
      });
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const message = 'Could not log in with Apple. Please try again.';
        showAuthNotice({ kind: 'error', message });
        onError?.(message);
        return;
      }

      captureOauthAuthCompleted(data.session.user.created_at, 'apple');
      showAuthNotice({ kind: 'success' });
      onSuccess?.();
    } catch (error) {
      if (isRequestCanceled(error)) {
        return;
      }

      const message = toUserFacingError(
        error,
        'Could not log in with Apple. Please try again.'
      );
      showAuthNotice({ kind: 'error', message });
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  if (!available) {
    return null;
  }

  return (
    <FeedbackPressable
      haptic="light"
      onPress={() => void handlePress()}
      disabled={isDisabled}
      className={`min-h-12 flex-row items-center justify-center gap-2 border border-border-soft bg-white ${
        compact ? 'flex-1 rounded-xl py-3' : 'rounded-2xl py-4'
      } ${isDisabled ? 'opacity-60' : ''}`}
      accessibilityLabel="Sign in with Apple"
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <View className="flex-row items-center gap-2">
          <Ionicons name="logo-apple" size={20} color={colors.brand} />
          <Text className="text-base text-brand font-outfit-bold">
            {compact ? 'Apple' : 'Sign in with Apple'}
          </Text>
        </View>
      )}
    </FeedbackPressable>
  );
}
