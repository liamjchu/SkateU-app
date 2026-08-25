import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { captureAuthCompleted } from '../lib/analytics';
import { useAuthStore } from '../store/authStore';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : undefined;

  if (email == null) {
    const handleReturnToLogin = async () => {
      try {
        await useAuthStore.getState().signOut();
      } catch {
        // Navigate even when there is no active Supabase session to clear.
      } finally {
        router.replace('/login');
      }
    };

    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <Text
          accessibilityRole="alert"
          className="text-center text-base text-muted font-outfit-medium"
        >
          Session data missing.
        </Text>
        <FeedbackPressable
          className="mt-4 rounded-2xl bg-accent px-5 py-3"
          onPress={handleReturnToLogin}
          accessibilityRole="button"
          accessibilityLabel="Return to sign in"
        >
          <Text
            className="text-base text-brand font-outfit-bold"
          >
            Return to sign in
          </Text>
        </FeedbackPressable>
      </View>
    );
  }

  return <VerifyOtpContent email={email} />;
}

function VerifyOtpContent({ email }: { email: string }) {
  const router = useRouter();

  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const resendSignUpOtp = useAuthStore((state) => state.resendSignUpOtp);

  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Seconds left before another resend is allowed. Starts ready.
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/login');
  };

  const handleChangeCode = (value: string) => {
    // Numbers only, capped at the code length.
    const digits = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(digits);

    if (error) {
      setError('');
    }

    // Verify automatically once all six digits are entered so the user doesn't
    // have to reach for the button.
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
      await verifyOtp(email, value);
      captureAuthCompleted('signup', 'email');
      router.replace('/');
    } catch (verifyError) {
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
      await resendSignUpOtp(email);
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
      <ScreenHeader title="Verify email" onBack={goBack} />

      <View className="flex-1 self-center w-full max-w-[640px] px-6 pt-8 pb-8">
        <Text
          className="text-2xl text-ink font-outfit-black"
        >
          Enter your code
        </Text>
        <Text
          className="mt-2 text-base text-muted font-outfit-medium"
        >
          {email
            ? `We sent a 6-digit verification code to ${email}.`
            : 'Enter the 6-digit verification code we emailed you.'}
        </Text>

        <View className="mt-8 gap-4">
          {/* A single input drives the six visible cells. */}
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
                    <Text
                      className="text-2xl text-ink font-outfit-bold"
                    >
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
            accessibilityLabel="6-digit verification code"
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
              className="text-sm text-errorText font-outfit-medium"
            >
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
              <Text className="text-sm text-ink font-outfit-semibold">
                {notice}
              </Text>
            </View>
          ) : null}

          <FeedbackPressable
            haptic="light"
            onPress={() => submitCode(code)}
            disabled={submitting}
            className={`mt-2 h-14 flex-row items-center justify-center rounded-2xl ${
              submitting ? 'bg-actionDisabled' : 'bg-accent'
            }`}
            accessibilityLabel={submitting ? 'Verifying code' : 'Verify code'}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Text className="text-lg text-brand font-outfit-bold">
                Verify
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
              className={`text-base ${
                cooldown > 0 || resending ? 'text-muted' : 'text-accent'
              } font-outfit-semibold`}
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
