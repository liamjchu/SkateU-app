import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../components/FeedbackPressable';
import LegalAcceptCheckbox from '../components/legal-accept-checkbox';
import { StickerStripe } from '../components/sticker';
import { canAcceptLegalTerms } from '../lib/legalAcceptance';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

export default function AcceptLegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const email = useAuthStore((state) => state.user?.email ?? '');
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const signOut = useAuthStore((state) => state.signOut);
  const sendDeleteAccountOtp = useAuthStore(
    (state) => state.sendDeleteAccountOtp
  );
  const acceptLegal = useProfileStore((state) => state.acceptLegal);
  const clearProfile = useProfileStore((state) => state.clearProfile);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closingAccount, setClosingAccount] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    canAcceptLegalTerms(agreed) &&
    Boolean(accessToken) &&
    !submitting &&
    !closingAccount;

  const handleAccept = async () => {
    if (!accessToken || !canSubmit) {
      if (!agreed) {
        setError('Confirm you are at least 13 and agree before continuing.');
      }
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await acceptLegal(accessToken);
    } catch (submitError) {
      setError(
        toUserFacingError(
          submitError,
          'Could not save your agreement. Try again.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnderThirteen = async () => {
    if (closingAccount || submitting) {
      return;
    }

    if (!email) {
      setError(
        'We need to close this account. Email support@skateu.app if you need help.'
      );
      return;
    }

    setClosingAccount(true);
    setError('');

    try {
      await sendDeleteAccountOtp(email);
      router.push({
        pathname: '/verify-delete-account',
        params: { email, from: 'accept-legal' },
      });
    } catch (submitError) {
      setError(
        toUserFacingError(
          submitError,
          'Could not start closing this account. Try again or email support@skateu.app.'
        )
      );
    } finally {
      setClosingAccount(false);
    }
  };

  const handleSignOut = async () => {
    try {
      clearProfile();
      await signOut();
    } catch {
      // The auth listener will settle state if sign-out cannot complete here.
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <View className="bg-brand">
        <View
          className="px-6 pb-4"
          style={{
            paddingTop: insets.top + 16,
          }}
        >
          <Text
            className="font-outfit-bold text-2xl text-white"
            numberOfLines={1}
          >
            Before you continue
          </Text>
        </View>
        <StickerStripe />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-[640px] self-center px-6 pt-8">
            <Text className="font-outfit-black text-2xl leading-8 text-ink">
              SkateU has a few rules
            </Text>
            <Text className="mt-2 font-outfit-medium text-base leading-6 text-muted">
              Read the documents, then confirm you are at least 13 to keep using
              your account.
            </Text>

            <View className="mt-8">
              <LegalAcceptCheckbox
                checked={agreed}
                onCheckedChange={(value) => {
                  setError('');
                  setAgreed(value);
                }}
                disabled={submitting || closingAccount}
              />
            </View>

            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="mt-4 font-outfit-medium text-sm leading-5 text-errorText"
              >
                {error}
              </Text>
            ) : null}

            <FeedbackPressable
              haptic="light"
              onPress={() => void handleAccept()}
              disabled={!canSubmit}
              className={`mt-6 min-h-14 items-center justify-center rounded-2xl px-5 py-4 ${
                canSubmit ? 'bg-accent' : 'bg-actionDisabled'
              }`}
              accessibilityRole="button"
              accessibilityLabel={submitting ? 'Saving' : 'Agree and continue'}
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            >
              <Text
                className={`text-center font-outfit-bold text-lg ${
                  canSubmit ? 'text-brand' : 'text-muted'
                }`}
              >
                {submitting ? 'Saving…' : 'Agree and continue'}
              </Text>
            </FeedbackPressable>

            <FeedbackPressable
              onPress={() => void handleUnderThirteen()}
              disabled={submitting || closingAccount}
              className="mt-3 min-h-14 items-center justify-center rounded-2xl bg-field px-5 py-4"
              accessibilityRole="button"
              accessibilityLabel="I am under 13"
              accessibilityState={{
                disabled: submitting || closingAccount,
                busy: closingAccount,
              }}
            >
              <Text className="text-center font-outfit-semibold text-base text-ink">
                {closingAccount ? 'Sending code…' : 'I am under 13'}
              </Text>
            </FeedbackPressable>

            <Text className="mt-3 px-1 text-center font-outfit-medium text-sm leading-5 text-muted">
              If you are under 13, we close this account after a code we email
              you.
            </Text>

            <FeedbackPressable
              onPress={handleSignOut}
              className="mt-8 min-h-12 items-center justify-center py-4"
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text className="font-outfit-semibold text-base text-muted">
                Sign out
              </Text>
            </FeedbackPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
