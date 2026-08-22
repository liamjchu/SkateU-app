import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import { PASSWORD_REQUIREMENTS, validatePassword } from '../lib/password';
import { updatePassword } from '../lib/password-reset';
import { colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

const getUpdateErrorMessage = (updateError: unknown): string => {
  const message = updateError instanceof Error ? updateError.message : '';

  if (/session|jwt|token|expired/i.test(message)) {
    return 'Your reset link has expired. Request a new one and try again.';
  }
  if (/network|fetch|internet/i.test(message)) {
    return 'Check your internet connection and try again.';
  }

  return 'We couldn’t update your password right now. Please try again.';
};

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const isPasswordRecovery = useAuthStore((state) => state.passwordRecovery);
  const completePasswordRecovery = useAuthStore(
    (state) => state.completePasswordRecovery
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) {
      return;
    }

    const redirectTimer = setTimeout(() => router.replace('/'), 1400);
    return () => clearTimeout(redirectTimer);
  }, [router, success]);

  const handleSubmit = async () => {
    if (submitting || success) {
      return;
    }

    if (!isPasswordRecovery) {
      setError('Your reset link has expired. Request a new one and try again.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await updatePassword(password, isPasswordRecovery);
      completePasswordRecovery();
      setSuccess(true);
    } catch (updateError) {
      setError(getUpdateErrorMessage(updateError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="New password"
        onBack={() => router.replace('/login')}
        backAccessibilityLabel="Back to sign in"
        backDisabled={submitting || success}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 self-center w-full max-w-[640px] px-6 pt-8 pb-8">
            <Text className="font-outfit-black text-2xl text-ink">
              Create a new password
            </Text>
            <Text className="mt-2 font-outfit-medium text-base text-muted">
              Choose a password you have not used before.
            </Text>
            <Text className="mt-2 font-outfit-medium text-sm text-muted">
              {PASSWORD_REQUIREMENTS}
            </Text>

            <View className="mt-8 gap-4">
              <View className="flex-row items-center rounded-2xl border border-border-soft bg-field pl-5 pr-2">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="New password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  editable={!submitting && !success}
                  className="flex-1 py-4 font-outfit-semibold text-base text-ink"
                  style={{ padding: 0 }}
                />
                <Pressable
                  onPress={() => setShowPassword((visible) => !visible)}
                  disabled={submitting || success}
                  hitSlop={8}
                  className="h-12 w-12 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityState={{ disabled: submitting || success }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={colors.muted}
                  />
                </Pressable>
              </View>

              <View className="flex-row items-center rounded-2xl border border-border-soft bg-field pl-5 pr-2">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Confirm new password"
                  secureTextEntry={!showConfirmation}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  editable={!submitting && !success}
                  className="flex-1 py-4 font-outfit-semibold text-base text-ink"
                  style={{ padding: 0 }}
                />
                <Pressable
                  onPress={() => setShowConfirmation((visible) => !visible)}
                  disabled={submitting || success}
                  hitSlop={8}
                  className="h-12 w-12 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'
                  }
                  accessibilityState={{ disabled: submitting || success }}
                >
                  <Ionicons
                    name={showConfirmation ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={colors.muted}
                  />
                </Pressable>
              </View>

              {error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  selectable
                  className="font-outfit-medium text-sm text-errorText">
                  {error}
                </Text>
              ) : null}

              {success ? (
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="rounded-2xl bg-field px-4 py-3"
                >
                  <Text
                    selectable
                    className="font-outfit-semibold text-sm text-ink"
                  >
                    Your password has been updated. Taking you back to SkateU...
                  </Text>
                </View>
              ) : (
                <FeedbackPressable
                  haptic="light"
                  onPress={handleSubmit}
                  disabled={submitting}
                  className={`mt-2 min-h-14 items-center justify-center rounded-2xl py-4 ${
                    submitting ? 'bg-actionDisabled' : 'bg-accent'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={submitting ? 'Saving new password' : 'Save new password'}
                  accessibilityState={{ disabled: submitting, busy: submitting }}
                >
                  <Text
                    className={`font-outfit-bold text-lg ${submitting ? 'text-muted' : 'text-brand'}`}
                  >
                    {submitting ? 'Saving…' : 'Save new password'}
                  </Text>
                </FeedbackPressable>
              )}

              {error.includes('expired') ? (
                <Pressable
                  onPress={() => router.replace('/forgot-password')}
                  disabled={submitting}
                  className="items-center justify-center py-1"
                  accessibilityRole="button"
                >
                  <Text className="font-outfit-semibold text-sm text-muted">
                    Request a new reset link
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
