import { useLocalSearchParams } from 'expo-router';
import { useGuardedRouter } from '../lib/navigationGuard';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import KeyboardShiftView from '../components/keyboard-shift-view';
import ScreenHeader from '../components/screen-header';
import SupportChoiceList from '../components/SupportChoiceList';
import { colors } from '../constants/colors';
import { captureAnalyticsEvent } from '../lib/analytics';
import { triggerHaptic } from '../lib/haptics';
import {
  PROFILE_REPORT_DETAILS_MAX,
  PROFILE_REPORT_REASON_OPTIONS,
  buildProfileReportMessage,
  getProfileReportDetailsError,
} from '../lib/profileReport';
import { submitUserFeedback } from '../lib/userFeedbackApi';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import type { CommentReportReason } from '../types/commentReport';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export default function ReportProfileScreen() {
  const router = useGuardedRouter();
  const searchParams = useLocalSearchParams();
  const userId = firstParam(searchParams.userId);
  const username = firstParam(searchParams.username);

  const session = useAuthStore((state) => state.session);

  const [reason, setReason] = useState<CommentReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showReasonError, setShowReasonError] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const detailsError = useMemo(
    () => getProfileReportDetailsError(details),
    [details]
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  const handleSubmit = async () => {
    if (!userId) {
      setSubmitError('This needs a profile. Head back and try again.');
      return;
    }

    if (!reason) {
      setShowReasonError(true);
      triggerHaptic('warning');
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSubmitError('Log in to report a profile.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitUserFeedback(
        {
          type: 'contact',
          category: 'other',
          message: buildProfileReportMessage({
            userId,
            username,
            reason,
            details,
          }),
        },
        accessToken
      );
      captureAnalyticsEvent('profile_reported', {
        reported_user_id: userId,
        reason,
      });
      triggerHaptic('success');
      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        toUserFacingError(error, 'Couldn’t send that report right now.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <ScreenHeader title="Report profile" onBack={goBack} />
      <KeyboardShiftView>
        {submitted ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center font-outfit-black text-2xl text-ink">
              Report sent
            </Text>
            <Text className="mt-3 text-center font-outfit-medium text-base leading-6 text-muted">
              Thanks. We’ll take a look at this profile.
            </Text>
            <FeedbackPressable
              haptic="light"
              onPress={goBack}
              className="mt-8 min-h-14 items-center justify-center rounded-2xl bg-accent px-8 py-4"
              accessibilityRole="button"
              accessibilityLabel="Back to profile"
            >
              <Text className="font-outfit-bold text-lg text-brand">Done</Text>
            </FeedbackPressable>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-6"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={false}
          >
            <Text className="font-outfit-medium text-base leading-6 text-muted">
              {username
                ? `Tell us what’s wrong with @${username}’s profile, photo, or username.`
                : 'Tell us what’s wrong with this profile, photo, or username.'}
            </Text>

            <Text className="mb-2 mt-6 font-outfit-bold text-base text-ink">
              Reason
            </Text>
            <SupportChoiceList
              options={PROFILE_REPORT_REASON_OPTIONS}
              value={reason}
              onChange={(value) => {
                setReason(value);
                setShowReasonError(false);
              }}
              error={
                showReasonError ? 'Choose what’s wrong with this profile.' : undefined
              }
            />

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
                placeholder="Anything else we should know..."
                placeholderTextColor={colors.muted}
                accessibilityLabel="Additional details"
                multiline
                maxLength={PROFILE_REPORT_DETAILS_MAX}
                textAlignVertical="top"
                value={details}
                onChangeText={setDetails}
              />
            </View>
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
                submitting ? 'Submitting profile report' : 'Submit profile report'
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
                  Submit report
                </Text>
              )}
            </FeedbackPressable>
          </ScrollView>
        )}
      </KeyboardShiftView>
    </SafeAreaView>
  );
}
