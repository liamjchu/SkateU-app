import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuthStore } from '../store/authStore';

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
};

export default function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
}: GoogleSignInButtonProps) {
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
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
      await signInWithGoogle();
      onSuccess?.();
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : 'Could not sign in with Google. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 py-4 ${
        isDisabled ? 'opacity-60' : ''
      }`}
      accessibilityLabel="Sign in with Google"
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color="#1B3B36" />
      ) : (
        <View className="flex-row items-center gap-2">
          <Ionicons name="logo-google" size={20} color="#1B3B36" />
          <Text
            className="text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            Sign in with Google
          </Text>
        </View>
      )}
    </Pressable>
  );
}
