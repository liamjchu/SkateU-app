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

export default function ReportBugScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const { submitting, runSubmit } = useSupportSubmit();

  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<SpotMediaItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const messageError = useMemo(
    () => getFeedbackMessageError('bug', message),
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
      setSubmitError('Sign in to report a bug.');
      return;
    }

    const screenshot = media[0]?.kind === 'new' ? media[0].asset : undefined;
    void runSubmit(async () => {
      setSubmitError('');
      try {
        await submitUserFeedback(
          {
            type: 'bug',
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
      title="Report a Bug"
      submitting={submitting}
      submitted={submitted}
      successTitle="Bug report submitted"
      successMessage="Thanks — we'll look into it."
      submitLabel="Submit report"
      submitDisabled={message.trim().length > 0 && Boolean(messageError)}
      submitError={submitError}
      onBack={goBack}
      onSubmit={handleSubmit}
    >
      <Text className="font-outfit-bold text-2xl text-ink">Report a Bug</Text>
      <Text className="mt-2 mb-6 font-outfit-medium text-base text-muted">
        Something isn’t working correctly.
      </Text>

      <SupportMessageField
        label="What happened?"
        value={message}
        onChangeText={setMessage}
        placeholder="Tell us what went wrong..."
        accessibilityLabel="What happened?"
        maxLength={FEEDBACK_MESSAGE_MAX}
        error={message.trim().length === 0 ? null : messageError}
      />

      <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
        Add Screenshot
      </Text>
      <Text className="mb-3 font-outfit-medium text-sm text-muted">
        Optional. A photo of the screen helps a lot.
      </Text>
      <View>
        <SpotImagePicker items={media} onChange={setMedia} max={1} />
      </View>
    </SupportFormShell>
  );
}
