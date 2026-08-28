import { useLocalSearchParams } from 'expo-router';
import { useGuardedRouter } from '../lib/navigationGuard';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import KeyboardShiftView from '../components/keyboard-shift-view';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { triggerHaptic } from '../lib/haptics';
import {
  SPOT_REMOVAL_DETAILS_MAX,
  SPOT_REMOVAL_REASON_OPTIONS,
  getSpotRemovalDetailsError,
} from '../lib/spotRemovalRequest';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useSpotsStore } from '../store/spotsStore';
import type { SpotRemovalReason } from '../types/spotRemovalRequest';

export default function RequestSpotRemovalScreen() {
  const router = useGuardedRouter();
  const searchParams = useLocalSearchParams();
  const spotId = Array.isArray(searchParams.spotId)
    ? searchParams.spotId[0]
    : searchParams.spotId;
  const spotName = Array.isArray(searchParams.spotName)
    ? searchParams.spotName[0]
    : searchParams.spotName;

  const session = useAuthStore((state) => state.session);
  const submitSpotRemovalRequest = useSpotsStore(
    (state) => state.submitSpotRemovalRequest
  );

  const [reason, setReason] = useState<SpotRemovalReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showReasonError, setShowReasonError] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const detailsError = useMemo(
    () => getSpotRemovalDetailsError(details),
    [details]
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/map');
  };

  const handleSubmit = async () => {
    if (!spotId) {
      setSubmitError('This needs a spot. Head back to the map and try again.');
      return;
    }

    if (!reason) {
      setShowReasonError(true);
      triggerHaptic('warning');
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSubmitError('Log in to request removal.');
      return;
    }

    if (detailsError) {
      triggerHaptic('warning');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitSpotRemovalRequest(spotId, reason, details, accessToken);
      triggerHaptic('success');
      setSubmitted(true);
    } catch (error) {
      triggerHaptic('warning');
      setSubmitError(
        toUserFacingError(error, 'Couldn’t submit this removal request right now.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <ScreenHeader
        title="Request Removal"
        onBack={goBack}
        backDisabled={submitting}
      />

      <KeyboardShiftView>
        {submitted ? (
          <View className="flex-1 justify-center px-6">
            <View className="w-full max-w-[720px] self-center rounded-2xl bg-field p-6">
              <Text className="font-outfit-bold text-2xl text-ink">
                Removal request submitted.
              </Text>
              <Text className="mt-3 font-outfit-medium text-base text-muted">
                Thanks for helping keep SkateU accurate.
              </Text>
              <FeedbackPressable
                haptic="light"
                onPress={goBack}
                className="mt-6 min-h-14 items-center justify-center rounded-2xl bg-accent px-5 py-4"
                accessibilityRole="button"
                accessibilityLabel="Back to the map"
              >
                <Text className="font-outfit-bold text-lg text-brand">Done</Text>
              </FeedbackPressable>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="w-full max-w-[720px] self-center px-6 pb-10 pt-5"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
            <Text className="font-outfit-bold text-2xl text-ink">
              Request Spot Removal
            </Text>
            {spotName ? (
              <Text className="mt-1 font-outfit-medium text-base text-muted">
                {spotName}
              </Text>
            ) : null}

            <Text className="mb-3 mt-6 font-outfit-bold text-base text-ink">
              What’s wrong with this spot?
            </Text>
            <View className="overflow-hidden rounded-2xl bg-field">
              {SPOT_REMOVAL_REASON_OPTIONS.map((option, index) => {
                const selected = reason === option.value;
                return (
                  <FeedbackPressable
                    key={option.value}
                    haptic="selection"
                    onPress={() => {
                      setReason(option.value);
                      setShowReasonError(false);
                    }}
                    className={`min-h-14 flex-row items-center px-4 py-3 ${
                      index > 0 ? 'border-t border-border-soft' : ''
                    }`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-accent bg-accent'
                          : 'border-border-soft bg-field'
                      }`}
                    >
                      {selected ? (
                        <View className="h-2 w-2 rounded-full bg-brand" />
                      ) : null}
                    </View>
                    <Text className="ml-3 flex-1 font-outfit-semibold text-base text-ink">
                      {option.label}
                    </Text>
                  </FeedbackPressable>
                );
              })}
            </View>
            {showReasonError ? (
              <Text
                accessibilityRole="alert"
                className="mt-2 font-outfit-medium text-sm text-errorText"
              >
                Choose what’s wrong with this spot.
              </Text>
            ) : null}

            <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
              Additional details (optional)
            </Text>
            <View
              className={`rounded-2xl border bg-field px-5 py-4 ${
                detailsError ? 'border-errorBorder' : 'border-border-soft'
              }`}
            >
              <TextInput
                className="min-h-32 w-full p-0 font-outfit-medium text-base text-ink"
                placeholder="Tell us what’s wrong with this spot..."
                placeholderTextColor={colors.muted}
                accessibilityLabel="Additional details"
                multiline
                maxLength={SPOT_REMOVAL_DETAILS_MAX}
                textAlignVertical="top"
                value={details}
                onChangeText={setDetails}
              />
            </View>
            {details.length > SPOT_REMOVAL_DETAILS_MAX * 0.8 ? (
              <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
                {details.length}/{SPOT_REMOVAL_DETAILS_MAX}
              </Text>
            ) : null}
            {detailsError ? (
              <Text
                accessibilityRole="alert"
                className="mt-2 font-outfit-medium text-sm text-errorText"
              >
                {detailsError}
              </Text>
            ) : null}

            {submitError ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="mt-4 text-center font-outfit-medium text-base text-errorText"
              >
                {submitError}
              </Text>
            ) : null}

            <FeedbackPressable
              haptic="light"
              onPress={() => {
                void handleSubmit();
              }}
              disabled={submitting || Boolean(detailsError)}
              className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
                submitting || detailsError ? 'bg-actionDisabled' : 'bg-accent'
              }`}
              accessibilityRole="button"
              accessibilityLabel={
                submitting ? 'Submitting removal request' : 'Submit removal request'
              }
              accessibilityState={{ disabled: submitting, busy: submitting }}
            >
              {submitting ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color={colors.muted} />
                  <Text className="ml-2 font-outfit-bold text-lg text-muted">
                    Submitting…
                  </Text>
                </View>
              ) : (
                <Text className="font-outfit-bold text-lg text-brand">
                  Submit request
                </Text>
              )}
            </FeedbackPressable>
          </ScrollView>
        )}
      </KeyboardShiftView>
    </SafeAreaView>
  );
}
