import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canCreateAccountAtAge } from '../lib/ageEligibility';
import { getPasswordRequirementStatus, validatePassword } from '../lib/password';
import { colors } from '../constants/colors';
import { toUserFacingError } from '../lib/userFacingError';
import { useAgeEligibilityStore } from '../store/ageEligibilityStore';
import { useAuthStore } from '../store/authStore';
import AppleSignInButton from './AppleSignInButton';
import FeedbackPressable from './FeedbackPressable';
import GoogleSignInButton from './GoogleSignInButton';
import LegalAuthNotice from './LegalAuthNotice';
import ScreenHeader from './screen-header';
import SocialLinks from './social-links';

type AuthCredentialsFormProps = {
  mode: 'login' | 'signup';
};

export default function AuthCredentialsForm({
  mode,
}: AuthCredentialsFormProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordInputRef = useRef<TextInput>(null);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const confirmedAgeEligibleThisSession = useAgeEligibilityStore(
    (state) => state.confirmedThisSession
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === 'signup';
  const isIOS = Platform.OS === 'ios';
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

  const finishAuth = () => {
    router.replace('/');
  };

  const goBack = () => {
    if (isSignup) {
      router.replace('/age-gate');
      return;
    }

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
      if (
        !confirmedAgeEligibleThisSession ||
        !canCreateAccountAtAge(true)
      ) {
        router.replace('/age-gate');
        return;
      }

      const passwordError = validatePassword(password);

      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setError('');
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

      finishAuth();
    } catch (submitError) {
      setError(toUserFacingError(submitError, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <View className="w-full max-w-[640px] self-center px-6 pt-5">
      <Text className="font-outfit-black text-2xl text-ink">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </Text>
      <Text className="mt-1 font-outfit-medium text-base leading-5 text-muted">
        {isSignup
          ? 'Sign up to like spots, add your own, and use your profile.'
          : 'Sign in to like spots, add your own, and use your profile.'}
      </Text>

      <View className="mt-5 gap-3">
        <View className="min-h-14 justify-center rounded-2xl border border-border-soft bg-field px-5">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            editable={!submitting}
            className="p-0 py-4 font-outfit-medium text-base text-ink"
          />
        </View>

        <View>
          <View className="min-h-14 flex-row items-center rounded-2xl border border-border-soft bg-field pl-5 pr-2">
            <TextInput
              ref={passwordInputRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              textContentType={isSignup ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => void handleSubmit()}
              editable={!submitting}
              className="flex-1 p-0 py-4 font-outfit-medium text-base text-ink"
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
                color={colors.muted}
              />
            </FeedbackPressable>
          </View>

          {!isSignup ? (
            <FeedbackPressable
              onPress={() => router.push('/forgot-password')}
              disabled={submitting}
              className="min-h-10 self-end items-center justify-center px-1"
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text className="font-outfit-semibold text-sm text-ink">
                Forgot password?
              </Text>
            </FeedbackPressable>
          ) : null}
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
            <Text className="font-outfit-bold text-sm text-ink">
              Password requirements
            </Text>
            {passwordRequirements.map((requirement) => (
              <View
                key={requirement.label}
                className="mt-2 flex-row items-center gap-2"
              >
                <Ionicons
                  name={
                    requirement.met ? 'checkmark-circle' : 'ellipse-outline'
                  }
                  size={18}
                  color={requirement.met ? colors.accent : colors.muted}
                />
                <Text
                  className={`font-outfit-medium text-sm ${
                    requirement.met ? 'text-accent' : 'text-muted'
                  }`}
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
            className="font-outfit-medium text-sm text-errorText"
          >
            {error}
          </Text>
        ) : null}

        <FeedbackPressable
          haptic="light"
          onPress={handleSubmit}
          disabled={submitting}
          className={`min-h-14 items-center justify-center rounded-2xl py-4 ${
            submitting ? 'bg-actionDisabled' : 'bg-accent'
          }`}
          accessibilityLabel={isSignup ? 'Sign up' : 'Sign in'}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
        >
          <Text
            className={`font-outfit-bold text-lg ${submitting ? 'text-muted' : 'text-brand'}`}
          >
            {submitting
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Sign up'
                : 'Sign in'}
          </Text>
        </FeedbackPressable>

        <FeedbackPressable
          onPress={() => {
            if (isSignup) {
              router.replace('/login');
              return;
            }

            router.push('/age-gate');
          }}
          disabled={submitting}
          className="min-h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={
            isSignup ? 'Switch to sign in' : 'Switch to sign up'
          }
        >
          <Text className="font-outfit-semibold text-sm text-muted">
            {isSignup
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </Text>
        </FeedbackPressable>

        <View className="flex-row items-center">
          <View className="h-px flex-1 bg-border-soft" />
          <Text className="mx-3 font-outfit-semibold text-sm text-muted">
            or
          </Text>
          <View className="h-px flex-1 bg-border-soft" />
        </View>

        <View className={isIOS ? 'flex-row gap-3' : 'gap-3'}>
          <GoogleSignInButton
            compact={isIOS}
            disabled={submitting}
            onSuccess={finishAuth}
            onError={(message) => setError(message)}
          />
          <AppleSignInButton
            compact={isIOS}
            disabled={submitting}
            onSuccess={finishAuth}
            onError={(message) => setError(message)}
          />
        </View>
      </View>

      <LegalAuthNotice />
      <View className="mt-6">
        <SocialLinks showCaption />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title={isSignup ? 'Sign up' : 'Sign in'} onBack={goBack} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
        >
          {form}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
