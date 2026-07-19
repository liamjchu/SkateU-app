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
import { PASSWORD_REQUIREMENTS, validatePassword } from '../lib/password';
import { updatePassword } from '../lib/password-reset';
import { useAuthStore } from '../store/authStore';

const getUpdateErrorMessage = (updateError: unknown): string => {
  const message = updateError instanceof Error ? updateError.message : '';

  if (/session|jwt|token|expired/i.test(message)) {
    return 'Your reset link has expired. Request a new one and try again.';
  }
  if (/network|fetch|internet/i.test(message)) {
    return 'Check your internet connection and try again.';
  }

  return 'We could not update your password right now. Please try again.';
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
    <View className="flex-1 bg-white">
      <View
        className="h-[136px] justify-center bg-[#21473f] px-6 pb-3 pt-[70px]"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.replace('/login')}
            disabled={submitting || success}
            className="h-12 w-12 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Back to login"
          >
            <Text className="text-xl text-white">❮</Text>
          </Pressable>
          <Text className="font-outfit-bold text-2xl text-white">
            New password
          </Text>
          <View className="h-11 w-11" />
        </View>
      </View>

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
          <View className="flex-1 self-center w-full max-w-[640px] px-5 pt-8 pb-8">
            <Text className="font-outfit-black text-3xl text-[#1B3B36]">
              Create a new password
            </Text>
            <Text className="mt-2 font-outfit-medium text-base text-slate-500">
              Choose a password you have not used before.
            </Text>
            <Text className="mt-2 font-outfit-medium text-sm text-slate-400">
              {PASSWORD_REQUIREMENTS}
            </Text>

            <View className="mt-8 gap-4">
              <View className="flex-row items-center rounded-2xl bg-[#F0F3F5] pr-3">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
                  placeholderTextColor="#52645F"
                  accessibilityLabel="New password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  editable={!submitting && !success}
                  className="flex-1 pl-4 pr-5 py-4 font-outfit-semibold text-base text-[#1B3B36]"
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
                    color="#52645F"
                  />
                </Pressable>
              </View>

              <View className="flex-row items-center rounded-2xl bg-[#F0F3F5] pr-3">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#52645F"
                  accessibilityLabel="Confirm new password"
                  secureTextEntry={!showConfirmation}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  editable={!submitting && !success}
                  className="flex-1 pl-4 pr-5 py-4 font-outfit-semibold text-base text-[#1B3B36]"
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
                    color="#52645F"
                  />
                </Pressable>
              </View>

              {error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  selectable
                  className="font-outfit-medium text-sm text-[#7F302C]">
                  {error}
                </Text>
              ) : null}

              {success ? (
                <View
                  accessible
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="rounded-2xl bg-[#EBF2F0] px-4 py-3">
                  <Text
                    selectable
                    className="font-outfit-semibold text-sm text-[#1B3B36]"
                  >
                    Your password has been updated. Taking you back to SkateU...
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting}
                  className={`mt-2 items-center justify-center rounded-2xl py-4 ${
                    submitting ? 'bg-[#60756F]' : 'bg-[#21473f]'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={submitting ? 'Saving new password' : 'Save new password'}
                  accessibilityState={{ disabled: submitting, busy: submitting }}
                >
                  <Text className="font-outfit-bold text-lg text-white">
                    {submitting ? 'Saving password...' : 'Save new password'}
                  </Text>
                </Pressable>
              )}

              {error.includes('expired') ? (
                <Pressable
                  onPress={() => router.replace('/forgot-password')}
                  disabled={submitting}
                  className="items-center justify-center py-1"
                  accessibilityRole="button"
                >
                  <Text className="font-outfit-semibold text-sm text-slate-500">
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
