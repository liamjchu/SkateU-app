import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import SpotImagePicker from '../../components/SpotImagePicker';
import SupportFormShell from '../../components/SupportFormShell';
import SupportMessageField from '../../components/SupportMessageField';
import { useSupportSubmit } from '../../hooks/useSupportSubmit';
import { collectClientDiagnostics } from '../../lib/appDiagnostics';
import { triggerHaptic } from '../../lib/haptics';
import {
  FEEDBACK_MESSAGE_MAX,
  getFeedbackMessageError,
} from '../../lib/userFeedback';
import { submitUserFeedback } from '../../lib/userFeedbackApi';
import { toUserFacingError } from '../../lib/userFacingError';
import { useAuthStore } from '../../store/authStore';
import type { SpotMediaItem } from '../../types/spot';

export default function SuggestFeatureScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const { submitting, runSubmit } = useSupportSubmit();

  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<SpotMediaItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const messageError = useMemo(
    () => getFeedbackMessageError('feature', message),
    [message]
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/help');
  };

  const handleSubmit = () => {
    if (messageError) {
      triggerHaptic('warning');
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSubmitError('Sign in to send an idea.');
      return;
    }

    const screenshot = media[0]?.kind === 'new' ? media[0].asset : undefined;
    void runSubmit(async () => {
      setSubmitError('');
      try {
        await submitUserFeedback(
          {
            type: 'feature',
            message,
            metadata: collectClientDiagnostics(pathname),
            screenshot,
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
      title="Suggest a Feature"
      submitting={submitting}
      submitted={submitted}
      successTitle="Thanks for the idea"
      successMessage="Your feedback has been sent to the SkateU team."
      submitLabel="Send idea"
      submitDisabled={message.trim().length > 0 && Boolean(messageError)}
      submitError={submitError}
      onBack={goBack}
      onSubmit={handleSubmit}
    >
      <Text className="font-outfit-bold text-2xl text-ink">Suggest a Feature</Text>
      <Text className="mt-2 mb-6 font-outfit-medium text-base text-muted">
        What would you like SkateU to add or improve?
      </Text>

      <SupportMessageField
        label="Your idea"
        value={message}
        onChangeText={setMessage}
        placeholder="Tell us what you’d add..."
        accessibilityLabel="Your idea"
        maxLength={FEEDBACK_MESSAGE_MAX}
        error={message.trim().length === 0 ? null : messageError}
      />

      <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
        Add a photo
      </Text>
      <Text className="mb-3 font-outfit-medium text-sm text-muted">Optional.</Text>
      <View>
        <SpotImagePicker items={media} onChange={setMedia} max={1} />
      </View>
    </SupportFormShell>
  );
}
