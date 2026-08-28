import { useLocalSearchParams, usePathname } from 'expo-router';
import { useGuardedRouter } from '../../lib/navigationGuard';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedbackPressable from '../../components/FeedbackPressable';
import ScreenHeader from '../../components/screen-header';
import SpotImagePicker from '../../components/SpotImagePicker';
import SupportChoiceList from '../../components/SupportChoiceList';
import SupportFormShell from '../../components/SupportFormShell';
import SupportMessageField from '../../components/SupportMessageField';
import { colors } from '../../constants/colors';
import { useSupportSubmit } from '../../hooks/useSupportSubmit';
import { collectClientDiagnostics } from '../../lib/appDiagnostics';
import { triggerHaptic } from '../../lib/haptics';
import {
  SPOT_PROBLEM_CATEGORY_OPTIONS,
  SPOT_PROBLEM_DETAILS_MAX,
  getFeedbackMessageError,
} from '../../lib/userFeedback';
import { submitUserFeedback } from '../../lib/userFeedbackApi';
import { toUserFacingError } from '../../lib/userFacingError';
import { useAuthStore } from '../../store/authStore';
import type { SpotMediaItem } from '../../types/spot';
import type { SpotProblemCategory } from '../../types/userFeedback';

export default function ReportSpotProblemScreen() {
  const router = useGuardedRouter();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams();
  const spotId = Array.isArray(searchParams.spotId)
    ? searchParams.spotId[0]
    : searchParams.spotId;
  const spotName = Array.isArray(searchParams.spotName)
    ? searchParams.spotName[0]
    : searchParams.spotName;

  const session = useAuthStore((state) => state.session);
  const { submitting, runSubmit } = useSupportSubmit();

  const [category, setCategory] = useState<SpotProblemCategory | null>(null);
  const [details, setDetails] = useState('');
  const [media, setMedia] = useState<SpotMediaItem[]>([]);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const detailsError = useMemo(
    () => getFeedbackMessageError('spot_problem', details),
    [details]
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (spotId) {
      router.replace('/map');
      return;
    }
    router.replace('/help');
  };

  const handleSubmit = () => {
    if (!spotId) {
      setSubmitError('This needs a spot. Head back to the map and try again.');
      return;
    }

    if (!category) {
      setShowCategoryError(true);
      triggerHaptic('warning');
      return;
    }

    if (detailsError) {
      triggerHaptic('warning');
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSubmitError('Log in to report a problem.');
      return;
    }

    const screenshot = media[0]?.kind === 'new' ? media[0].asset : undefined;
    void runSubmit(async () => {
      setSubmitError('');
      try {
        await submitUserFeedback(
          {
            type: 'spot_problem',
            category,
            message: details,
            spotId,
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

  if (!spotId) {
    return (
      <SafeAreaView
        edges={['left', 'right']}
        style={{ flex: 1, backgroundColor: colors.surface }}
      >
        <ScreenHeader title="Report a Problem" onBack={goBack} />
        <View className="flex-1 px-6 pt-6">
          <View className="w-full max-w-[720px] self-center">
            <Text className="font-outfit-bold text-2xl text-ink">
              Report a Problem
            </Text>
            <Text className="mt-3 font-outfit-medium text-base text-muted">
              Open a spot on the map, then tap Report a Problem. SkateU will attach
              that spot automatically.
            </Text>
            <FeedbackPressable
              haptic="light"
              onPress={() => router.replace('/')}
              className="mt-6 min-h-14 items-center justify-center rounded-2xl bg-accent px-5 py-4"
              accessibilityRole="button"
              accessibilityLabel="Find a campus"
            >
              <Text className="font-outfit-bold text-lg text-brand">
                Find a campus
              </Text>
            </FeedbackPressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SupportFormShell
      title="Report a Problem"
      submitting={submitting}
      submitted={submitted}
      successTitle="Report submitted"
      successMessage="Thanks for helping keep SkateU accurate."
      submitLabel="Submit report"
      submitDisabled={Boolean(detailsError)}
      submitError={submitError}
      onBack={goBack}
      onSubmit={handleSubmit}
    >
      <Text className="font-outfit-bold text-2xl text-ink">Report a Problem</Text>
      {spotName ? (
        <Text className="mt-1 font-outfit-medium text-base text-muted">{spotName}</Text>
      ) : null}

      <Text className="mb-3 mt-6 font-outfit-bold text-base text-ink">
        What’s wrong with this spot?
      </Text>
      <SupportChoiceList
        options={SPOT_PROBLEM_CATEGORY_OPTIONS}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setShowCategoryError(false);
        }}
        error={showCategoryError ? 'Choose what’s wrong with this spot.' : undefined}
      />

      <View className="mt-6">
        <SupportMessageField
          label="Details (optional)"
          value={details}
          onChangeText={setDetails}
          placeholder="Anything else we should know?"
          accessibilityLabel="Additional details"
          maxLength={SPOT_PROBLEM_DETAILS_MAX}
          error={detailsError}
        />
      </View>

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
