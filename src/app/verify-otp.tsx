import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '../store/authStore';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

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
    <View className="flex-1 bg-white">
      <View className="bg-[#21473f] px-6 pb-8 pt-25">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={goBack}
            className="h-11 w-11 items-center justify-center rounded-full"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text className="text-xl text-white">❮</Text>
          </Pressable>

          <Text
            className="text-3xl text-white"
            style={{ fontFamily: 'Outfit_900Black' }}
          >
            Verify email
          </Text>

          <View className="h-11 w-11" />
        </View>
      </View>

      <View className="flex-1 px-5 pt-8">
        <Text
          className="text-3xl text-[#1B3B36]"
          style={{ fontFamily: 'Outfit_900Black' }}
        >
          Enter your code
        </Text>
        <Text
          className="mt-2 text-base text-slate-500"
          style={{ fontFamily: 'Outfit_500Medium' }}
        >
          {email
            ? `We sent a 6-digit verification code to ${email}.`
            : 'Enter the 6-digit verification code we emailed you.'}
        </Text>

        <View className="mt-8 gap-4">
          {/* A single input drives the six visible cells. */}
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View className="flex-row justify-between">
              {cells.map((_, index) => {
                const char = code[index] ?? '';
                const isActive = index === code.length;

                return (
                  <View
                    key={index}
                    className={`h-14 w-12 items-center justify-center rounded-2xl bg-[#F0F3F5] ${
                      isActive ? 'border-2 border-[#21473f]' : ''
                    }`}
                  >
                    <Text
                      className="text-2xl text-[#1B3B36]"
                      style={{ fontFamily: 'Outfit_700Bold' }}
                    >
                      {char}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChangeCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            editable={!submitting}
            autoFocus
            className="absolute h-px w-px opacity-0"
          />

          {error ? (
            <Text
              className="text-sm text-red-500"
              style={{ fontFamily: 'Outfit_500Medium' }}
            >
              {error}
            </Text>
          ) : null}

          {notice ? (
            <View className="rounded-2xl bg-[#EBF2F0] px-4 py-3">
              <Text
                className="text-sm text-[#1B3B36]"
                style={{ fontFamily: 'Outfit_600SemiBold' }}
              >
                {notice}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => submitCode(code)}
            disabled={submitting}
            className={`mt-2 h-14 flex-row items-center justify-center rounded-2xl ${
              submitting ? 'bg-[#21473f]/60' : 'bg-[#21473f]'
            }`}
            accessibilityLabel="Verify code"
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                className="text-lg text-white"
                style={{ fontFamily: 'Outfit_700Bold' }}
              >
                Verify
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            className="items-center justify-center py-1"
            accessibilityRole="button"
            accessibilityLabel="Resend code"
          >
            <Text
              className={`text-base ${
                cooldown > 0 || resending ? 'text-slate-400' : 'text-[#21473f]'
              }`}
              style={{ fontFamily: 'Outfit_600SemiBold' }}
            >
              {resending
                ? 'Sending...'
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
