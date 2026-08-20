import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Text,
    TextInput,
    View,
} from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

// Mirrors verify-otp.tsx's styling exactly (same header, boxed-cell code
// entry, hidden input) but verifies identity before a permanent account
// deletion instead of confirming a new signup.
export default function VerifyDeleteAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; from?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const fromAcceptLegal = params.from === 'accept-legal';

  const verifyDeleteAccountOtp = useAuthStore(
    (state) => state.verifyDeleteAccountOtp
  );
  const sendDeleteAccountOtp = useAuthStore(
    (state) => state.sendDeleteAccountOtp
  );
  const deleteAccount = useAuthStore((state) => state.deleteAccount);

  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const goBack = () => {
    if (fromAcceptLegal) {
      router.replace('/accept-legal');
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/settings');
  };

  const handleChangeCode = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(digits);

    if (error) {
      setError('');
    }

    if (digits.length === CODE_LENGTH) {
      submitCode(digits);
    }
  };

  const submitCode = async (value: string) => {
    if (submitting) {
      return;
    }

    if (value.length !== CODE_LENGTH) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      await verifyDeleteAccountOtp(email, value);
      await deleteAccount();
      Alert.alert(
        'Account deleted',
        'Your SkateU account has been permanently deleted.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (verifyError) {
      setCode('');
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'Invalid or expired code. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) {
      return;
    }

    setError('');
    setNotice('');
    setResending(true);

    try {
      await sendDeleteAccountOtp(email);
      setNotice('We sent a new code to your email.');
      setCooldown(RESEND_COOLDOWN);
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : 'Could not resend the code. Try again shortly.'
      );
    } finally {
      setResending(false);
    }
  };

  const cells = Array.from({ length: CODE_LENGTH });

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Delete account" onBack={goBack} />

      <View className="flex-1 self-center w-full max-w-[640px] px-6 pt-8 pb-8">
        <Text className="font-outfit-black text-2xl text-ink">
          Enter your code
        </Text>
        <Text className="mt-2 font-outfit-medium text-base text-muted">
          {email
            ? `We sent a 6-digit verification code to ${email}. Enter it to permanently delete your account.`
            : 'Enter the 6-digit verification code we emailed you to permanently delete your account.'}
        </Text>

        <View className="mt-8 gap-4">
          <FeedbackPressable
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel={`Verification code, ${code.length} of ${CODE_LENGTH} digits entered`}
            accessibilityHint="Opens the 6-digit verification code input"
          >
            <View className="flex-row gap-2">
              {cells.map((_, index) => {
                const char = code[index] ?? '';
                const isActive = index === code.length;

                return (
                  <View
                    key={index}
                    className={`h-14 flex-1 items-center justify-center rounded-2xl bg-field ${
                      isActive ? 'border-2 border-accent' : 'border border-border-soft'
                    }`}
                  >
                    <Text className="font-outfit-bold text-2xl text-ink">
                      {char}
                    </Text>
                  </View>
                );
              })}
            </View>
          </FeedbackPressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChangeCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            accessibilityLabel="6-digit account deletion verification code"
            accessibilityHint="Enter the code sent to your email"
            accessibilityValue={{ text: `${code.length} of ${CODE_LENGTH} digits entered` }}
            editable={!submitting}
            autoFocus
            className="absolute h-px w-px opacity-0"
          />

          {error ? (
            <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="font-outfit-medium text-sm text-errorText">
              {error}
            </Text>
          ) : null}

          {notice ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="rounded-2xl bg-field px-4 py-3"
            >
              <Text className="font-outfit-semibold text-sm text-ink">
                {notice}
              </Text>
            </View>
          ) : null}

          <FeedbackPressable
            haptic="warning"
            onPress={() => submitCode(code)}
            disabled={submitting}
            className={`mt-2 h-14 flex-row items-center justify-center rounded-2xl ${
              submitting ? 'bg-actionDisabled' : 'bg-errorText'
            }`}
            accessibilityLabel={submitting ? 'Verifying and deleting account' : 'Confirm account deletion'}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Text className="font-outfit-bold text-lg text-white">
                Verify and delete
              </Text>
            )}
          </FeedbackPressable>

          <FeedbackPressable
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            className="min-h-12 items-center justify-center px-2 py-1"
            accessibilityRole="button"
            accessibilityLabel={
              resending
                ? 'Sending a new verification code'
                : cooldown > 0
                  ? `Resend verification code in ${cooldown} seconds`
                  : 'Resend verification code'
            }
            accessibilityState={{ disabled: resending || cooldown > 0, busy: resending }}
          >
            <Text
              className={`font-outfit-semibold text-base ${
                cooldown > 0 || resending ? 'text-muted' : 'text-accent'
              }`}
            >
              {resending
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : 'Resend code'}
            </Text>
          </FeedbackPressable>
        </View>
      </View>
    </View>
  );
}
