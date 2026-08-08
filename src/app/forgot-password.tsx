import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
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
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title="Reset password"
        onBack={() => router.replace('/login')}
        backAccessibilityLabel="Back to login"
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
          <View className="flex-1 self-center w-full max-w-[640px] px-5 pt-8 pb-8">
            <Text className="font-outfit-black text-3xl text-ink">
              Forgot your password?
            </Text>
            <Text className="mt-2 font-outfit-medium text-base text-slate-500">
              Enter your email and we&apos;ll send a link to reset it.
            </Text>

            <View className="mt-8 gap-4">
              <View className="gap-2">
                <Text
                  nativeID="reset-email-label"
                  className="font-outfit-semibold text-sm text-ink"
                >
                  Email address
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@email.com"
                  placeholderTextColor="#94A3B8"
                  accessibilityLabelledBy="reset-email-label"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="send"
                  onSubmitEditing={() => void handleSubmit()}
                  editable={!submitting}
                  className="min-h-14 rounded-2xl border border-border-soft bg-field px-4 py-4 font-outfit-medium text-base text-ink"
                />
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

              {notice ? (
                <View
                  accessible
                  accessibilityLiveRegion="polite"
                  className="rounded-2xl bg-surface-tinted px-4 py-3">
                  <Text
                    selectable
                    className="font-outfit-semibold text-sm text-ink"
                  >
                    {notice}
                  </Text>
                </View>
              ) : null}

              <FeedbackPressable
                haptic="light"
                onPress={handleSubmit}
                disabled={submitting}
                className={`mt-2 min-h-14 items-center justify-center rounded-2xl py-4 ${
                  submitting ? 'bg-disabledGreen' : 'bg-brand'
                }`}
                accessibilityRole="button"
                accessibilityLabel={submitting ? 'Sending password reset link' : 'Send password reset link'}
                accessibilityState={{ disabled: submitting, busy: submitting }}
              >
                <Text className="font-outfit-bold text-lg text-white">
                  {submitting ? 'Sending link...' : 'Send reset link'}
                </Text>
              </FeedbackPressable>

              {notice === SUCCESS_MESSAGE ? (
                <FeedbackPressable
                  onPress={() => router.replace('/login')}
                  className="min-h-12 items-center justify-center rounded-2xl border border-brand px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="Back to login"
                >
                  <Text className="font-outfit-bold text-base text-brand">
                    Back to login
                  </Text>
                </FeedbackPressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
