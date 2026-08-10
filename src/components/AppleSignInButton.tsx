import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { signInWithAppleIdentityToken } from '../lib/appleAuthentication';

type AppleSignInButtonProps = {
  disabled?: boolean;
  onError?: (message: string) => void;
  onSuccess?: () => void;
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
}: AppleSignInButtonProps) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const handlePress = async () => {
    if (disabled || loading) {
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
      onSuccess?.();
    } catch (error) {
      if (isRequestCanceled(error)) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Could not sign in with Apple. Please try again.';
      Alert.alert('Apple sign in failed', message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  if (!available) {
    return null;
  }

  const isDisabled = disabled || loading;

  return (
    <View
      pointerEvents={isDisabled ? 'none' : 'auto'}
      className={isDisabled ? 'opacity-60' : undefined}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        cornerRadius={16}
        onPress={() => void handlePress()}
        style={{ height: 56, width: '100%' }}
      />
    </View>
  );
}
