import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import SupportChoiceList from '../../components/SupportChoiceList';
import SupportFormShell from '../../components/SupportFormShell';
import SupportMessageField from '../../components/SupportMessageField';
import { colors } from '../../constants/colors';
import { useSupportSubmit } from '../../hooks/useSupportSubmit';
import { collectClientDiagnostics } from '../../lib/appDiagnostics';
import { triggerHaptic } from '../../lib/haptics';
import {
  CONTACT_CATEGORY_OPTIONS,
  FEEDBACK_MESSAGE_MAX,
  getFeedbackEmailError,
  getFeedbackMessageError,
} from '../../lib/userFeedback';
import { submitUserFeedback } from '../../lib/userFeedbackApi';
import { toUserFacingError } from '../../lib/userFacingError';
import { useAuthStore } from '../../store/authStore';
import type { ContactCategory } from '../../types/userFeedback';

export default function ContactSkateUScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const knownEmail = useAuthStore((state) => state.user?.email ?? '');
  const { submitting, runSubmit } = useSupportSubmit();

  const [category, setCategory] = useState<ContactCategory | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const messageError = useMemo(
    () => getFeedbackMessageError('contact', message),
    [message]
  );
  const emailError = useMemo(() => {
    if (knownEmail) {
      return null;
    }
    return email.trim().length === 0 ? null : getFeedbackEmailError(email);
  }, [email, knownEmail]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/help');
  };

  const handleSubmit = () => {
    if (!category) {
      setShowCategoryError(true);
      triggerHaptic('warning');
      return;
    }

    if (messageError) {
      triggerHaptic('warning');
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSubmitError('Sign in to send a message.');
      return;
    }

    if (!knownEmail) {
      const missingEmail = getFeedbackEmailError(email);
      if (missingEmail) {
        triggerHaptic('warning');
        setSubmitError(missingEmail);
        return;
      }
    }

    void runSubmit(async () => {
      setSubmitError('');
      try {
        await submitUserFeedback(
          {
            type: 'contact',
            category,
            message,
            email: knownEmail ? undefined : email.trim(),
            metadata: collectClientDiagnostics(pathname),
          },
          accessToken
        );
        triggerHaptic('success');
        setSubmitted(true);
      } catch (error) {
        triggerHaptic('warning');
        setSubmitError(
          toUserFacingError(error, 'Couldn’t send that right now. Try again in a sec.')
        );
      }
    });
  };

  return (
    <SupportFormShell
      title="Contact SkateU"
      submitting={submitting}
      submitted={submitted}
      successTitle="Message sent"
      successMessage="Thanks for reaching out to SkateU."
      submitLabel="Send message"
      submitDisabled={
        (message.trim().length > 0 && Boolean(messageError)) || Boolean(emailError)
      }
      submitError={submitError}
      onBack={goBack}
      onSubmit={handleSubmit}
    >
      <Text className="font-outfit-bold text-2xl text-ink">Contact SkateU</Text>
      <Text className="mt-2 mb-6 font-outfit-medium text-base text-muted">
        Have a question, feedback, partnership idea, or something else? Send us a
        message.
      </Text>

      <Text className="mb-3 font-outfit-bold text-base text-ink">Category</Text>
      <SupportChoiceList
        options={CONTACT_CATEGORY_OPTIONS}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setShowCategoryError(false);
        }}
        error={showCategoryError ? 'Choose a category.' : undefined}
      />

      <View className="mt-6">
        <SupportMessageField
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="What should we know?"
          accessibilityLabel="Message"
          maxLength={FEEDBACK_MESSAGE_MAX}
          error={message.trim().length === 0 ? null : messageError}
        />
      </View>

      <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">Email</Text>
      {knownEmail ? (
        <View className="rounded-2xl border border-border-soft bg-field px-5 py-4">
          <Text className="font-outfit-medium text-base text-ink">{knownEmail}</Text>
        </View>
      ) : (
        <View
          className={`rounded-2xl border bg-field px-5 py-4 ${
            emailError ? 'border-errorBorder' : 'border-border-soft'
          }`}
        >
          <TextInput
            className="w-full p-0 font-outfit-medium text-base text-ink"
            placeholder="you@email.com"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
        </View>
      )}
      {emailError ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-outfit-medium text-sm text-errorText"
        >
          {emailError}
        </Text>
      ) : null}
    </SupportFormShell>
  );
}
