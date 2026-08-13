import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import AppleSignInButton from '../components/AppleSignInButton';
import FeedbackPressable from '../components/FeedbackPressable';
import GoogleSignInButton from '../components/GoogleSignInButton';
import ScreenHeader from '../components/screen-header';
import {
  getPasswordRequirementStatus,
  validatePassword,
} from '../lib/password';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const passwordInputRef = useRef<TextInput>(null);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === 'signup';
  const passwordRequirementStatus = getPasswordRequirementStatus(password);
  const passwordRequirements = [
    {
      label: 'At least 8 characters',
      met: passwordRequirementStatus.minLength,
    },
    {
      label: 'Uppercase and lowercase letters',
      met: passwordRequirementStatus.upperAndLowerCase,
    },
    {
      label: 'At least one number',
      met: passwordRequirementStatus.number,
    },
    {
      label: 'At least one special character',
      met: passwordRequirementStatus.specialCharacter,
    },
  ];

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (isSignup) {
      const passwordError = validatePassword(password);

      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      if (isSignup) {
        const { needsEmailConfirmation } = await signUp(email, password);

        if (needsEmailConfirmation) {
          router.push({
            pathname: '/verify-otp',
            params: { email: email.trim() },
          });
          return;
        }
      } else {
        await signIn(email, password);
      }

      router.replace('/');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader
        title={isSignup ? 'Sign up' : 'Login'}
        onBack={goBack}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 self-center w-full max-w-[640px] px-5 pt-8 pb-8">
        <Text
          className="text-3xl text-ink font-outfit-black"
        >
          {isSignup ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text
          className="mt-2 text-base text-slate-500 font-outfit-medium"
        >
          {isSignup
            ? 'Sign up to add and share campus skate spots.'
            : 'Login to use your profile and add campus skate spots.'}
        </Text>

        <View className="mt-8 gap-4">
          <View className="gap-2">
            <Text
              nativeID="login-email-label"
              className="font-outfit-semibold text-sm text-ink"
            >
              Email address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@email.com"
              placeholderTextColor="#94A3B8"
              accessibilityLabelledBy="login-email-label"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              editable={!submitting}
              className="min-h-14 rounded-2xl border border-border-soft bg-field px-4 py-4 font-outfit-medium text-base text-ink"
            />
          </View>

          <View className="gap-2">
            <Text
              nativeID="login-password-label"
              className="font-outfit-semibold text-sm text-ink"
            >
              Password
            </Text>
            <View className="min-h-14 flex-row items-center rounded-2xl border border-border-soft bg-field pr-2">
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                placeholder={isSignup ? 'Create a strong password' : 'Enter your password'}
                placeholderTextColor="#94A3B8"
                accessibilityLabelledBy="login-password-label"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                textContentType={isSignup ? 'newPassword' : 'password'}
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
                editable={!submitting}
                className="flex-1 px-4 py-4 font-outfit-medium text-base text-ink"
              />
              <FeedbackPressable
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={submitting}
                className="h-12 w-12 items-center justify-center rounded-full"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#52645F"
                />
              </FeedbackPressable>
            </View>
          </View>

          {isSignup ? (
            <View
              accessible
              accessibilityLabel={`Password requirements. ${passwordRequirements
                .map(
                  (requirement) =>
                    `${requirement.label}: ${requirement.met ? 'met' : 'not met'}`
                )
                .join('. ')}.`}
              className="rounded-2xl border border-border-soft bg-surface-soft px-4 py-3"
            >
              <Text
                className="text-sm text-ink font-outfit-bold"
              >
                Password requirements
              </Text>
              {passwordRequirements.map((requirement) => (
                <View
                  key={requirement.label}
                  className="mt-2 flex-row items-center gap-2"
                >
                  <Ionicons
                    name={
                      requirement.met
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                    }
                    size={18}
                    color={requirement.met ? '#21473F' : '#52645F'}
                  />
                  <Text
                    className={`text-sm ${
                      requirement.met ? 'text-darkGreen' : 'text-slate-500'
                    } font-outfit-medium`}
                  >
                    {requirement.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

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
              accessibilityLiveRegion="polite"
              className="rounded-2xl bg-surface-tinted px-4 py-3">
              <Text
                selectable
                className="font-outfit-semibold text-sm text-ink"
              >
                {notice}
              </Text>
            </View>
          ) : null}

          <FeedbackPressable
            haptic="light"
            onPress={handleSubmit}
            disabled={submitting}
            className={`mt-2 min-h-14 items-center justify-center rounded-2xl py-4 ${
              submitting ? 'bg-disabledGreen' : 'bg-brand'
            }`}
            accessibilityLabel={isSignup ? 'Sign up' : 'Login'}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            <Text
              className="font-outfit-bold text-lg text-white"
            >
              {submitting
                ? 'Please wait...'
                : isSignup
                  ? 'Sign up'
                  : 'Login'}
            </Text>
          </FeedbackPressable>

          <View className="gap-1">
            <FeedbackPressable
              onPress={() => {
                setError('');
                setNotice('');
                setMode(isSignup ? 'login' : 'signup');
              }}
              disabled={submitting}
              className="min-h-12 items-center justify-center rounded-xl px-2"
              accessibilityRole="button"
              accessibilityLabel={
                isSignup ? 'Switch to login' : 'Switch to sign up'
              }
            >
              <Text
                className="font-outfit-semibold text-base text-muted"
              >
                {isSignup
                  ? 'Already have an account? Login'
                  : "Don't have an account? Sign up"}
              </Text>
            </FeedbackPressable>

            {!isSignup ? (
              <FeedbackPressable
                onPress={() => router.push('/forgot-password')}
                disabled={submitting}
                className="min-h-12 items-center justify-center rounded-xl px-2"
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
              >
                <Text
                  className="font-outfit-semibold text-base text-muted"
                >
                  Forgot password?
                </Text>
              </FeedbackPressable>
            ) : null}
          </View>

          {!isSignup ? (
            <>
              <View className="flex-row items-center">
                <View className="h-px flex-1 bg-slate-200" />
                <Text
                  className="mx-3 text-sm text-slate-400 font-outfit-semibold"
                >
                  or
                </Text>
                <View className="h-px flex-1 bg-slate-200" />
              </View>

              <GoogleSignInButton
                disabled={submitting}
                onSuccess={() => router.replace('/')}
                onError={(message) => setError(message)}
              />

              <AppleSignInButton
                disabled={submitting}
                onSuccess={() => router.replace('/')}
                onError={(message) => setError(message)}
              />
            </>
          ) : null}
        </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
