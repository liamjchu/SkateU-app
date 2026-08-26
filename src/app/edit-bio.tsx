import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TextInput, View } from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import KeyboardShiftView from '../components/keyboard-shift-view';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import {
  PROFILE_BIO_MAX,
  getProfileBioError,
} from '../lib/profileBio';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

export default function EditBioScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const savedBio = useProfileStore((state) => state.profile?.bio ?? '');
  const updateBio = useProfileStore((state) => state.updateBio);

  const [value, setValue] = useState(savedBio);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const lengthError = getProfileBioError(value);
  const unchanged = value.trim() === savedBio.trim();
  const canSubmit =
    Boolean(accessToken) && !submitting && !unchanged && lengthError === null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/settings');
  };

  const handleSubmit = async () => {
    if (!accessToken || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await updateBio(accessToken, value);
      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }
      goBack();
    } catch (error) {
      setSubmitError(
        toUserFacingError(error, 'Could not save the bio. Try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Bio" onBack={goBack} />

      <KeyboardShiftView>
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow self-center w-full max-w-[640px] px-6 pt-8 pb-8"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-outfit-black text-2xl text-ink">
            {savedBio ? 'Edit your bio' : 'Add a bio'}
          </Text>
          <Text className="mt-2 font-outfit-medium text-base text-muted">
            A short intro, or a social handle. Keep it school-friendly.
          </Text>

          <View className="mt-8 rounded-2xl border border-border-soft bg-field px-5 py-4">
            <TextInput
              className="min-h-32 w-full p-0 font-outfit-medium text-base text-ink"
              placeholder="Skater at State. IG: yourhandle"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Profile bio"
              multiline
              maxLength={PROFILE_BIO_MAX}
              textAlignVertical="top"
              value={value}
              editable={!submitting}
              onChangeText={(next) => {
                setSubmitError('');
                setValue(next);
              }}
            />
          </View>
          <Text className="mt-1 self-end font-outfit-medium text-sm tabular-nums text-muted">
            {value.trim().length}/{PROFILE_BIO_MAX}
          </Text>

          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-2 min-h-[20px] px-1"
          >
            {submitError ? (
              <Text className="font-outfit-medium text-sm text-errorText">
                {submitError}
              </Text>
            ) : lengthError ? (
              <Text className="font-outfit-medium text-sm text-errorText">
                {lengthError}
              </Text>
            ) : unchanged && savedBio.length > 0 ? (
              <Text className="font-outfit-medium text-sm text-muted">
                That’s your current bio.
              </Text>
            ) : null}
          </View>

          <FeedbackPressable
            haptic="light"
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
            className={`mt-6 min-h-14 w-full items-center justify-center rounded-2xl py-4 ${
              canSubmit ? 'bg-accent' : 'bg-actionDisabled'
            }`}
            accessibilityLabel={submitting ? 'Saving…' : 'Save bio'}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          >
            <Text
              className={`font-outfit-bold text-lg ${canSubmit ? 'text-brand' : 'text-muted'}`}
            >
              {submitting ? 'Saving…' : 'Save bio'}
            </Text>
          </FeedbackPressable>
        </ScrollView>
      </KeyboardShiftView>
    </View>
  );
}
