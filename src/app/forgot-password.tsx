import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { requestPasswordResetEmail } from '../lib/password-reset';

const SUCCESS_MESSAGE =
  'If an account exists with that email, a password reset link has been sent.';

const getRequestErrorMessage = (requestError: unknown): string => {
  const message = requestError instanceof Error ? requestError.message : '';

  if (/network|fetch|internet/i.test(message)) {
    return 'Check your internet connection and try again.';
  }

  return 'We could not send a reset link right now. Please try again.';
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetError } = useLocalSearchParams<{ resetError?: string }>();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    resetError === 'expired'
      ? 'This reset link is invalid or has expired. Request a new one below.'
      : ''
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      await requestPasswordResetEmail(email);
      // This deliberately does not reveal whether the email exists or uses OAuth.
      setNotice(SUCCESS_MESSAGE);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View
        className="h-[126px] justify-center bg-[#21473f] px-6 pb-3 pt-[70px]"
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
            className="h-11 w-11 items-center justify-center rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Back to login"
          >
            <Text className="text-xl text-white">❮</Text>
          </Pressable>
          <Text
            className="text-2xl text-white"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            Reset password
          </Text>
          <View className="h-11 w-11" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-5 pt-8">
            <Text
              className="text-3xl text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_900Black' }}
            >
              Forgot your password?
            </Text>
            <Text
              className="mt-2 text-base text-slate-500"
              style={{ fontFamily: 'Outfit_500Medium' }}
            >
              Enter your email and we&apos;ll send a link to reset it.
            </Text>

            <View className="mt-8 gap-4">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="#8E9AA6"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                editable={!submitting}
                className="rounded-2xl bg-[#F0F3F5] pl-4 pr-5 py-4 text-base text-[#1B3B36]"
                style={{ fontFamily: 'Outfit_600SemiBold' }}
              />

              {error ? (
                <Text
                  selectable
                  className="text-sm text-red-500"
                  style={{ fontFamily: 'Outfit_500Medium' }}
                >
                  {error}
                </Text>
              ) : null}

              {notice ? (
                <View className="rounded-2xl bg-[#EBF2F0] px-4 py-3">
                  <Text
                    selectable
                    className="text-sm text-[#1B3B36]"
                    style={{ fontFamily: 'Outfit_600SemiBold' }}
                  >
                    {notice}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                className={`mt-2 items-center justify-center rounded-2xl py-4 ${
                  submitting ? 'bg-[#21473f]/60' : 'bg-[#21473f]'
                }`}
                accessibilityRole="button"
                accessibilityLabel="Send password reset link"
              >
                <Text
                  className="text-lg text-white"
                  style={{ fontFamily: 'Outfit_700Bold' }}
                >
                  {submitting ? 'Sending link...' : 'Send reset link'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
