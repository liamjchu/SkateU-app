import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
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
    <View className="flex-1 bg-white">
      <View
        className="h-[126px] justify-center bg-[#21473f] px-6 pb-3 pt-[70px]"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
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
            className="text-2xl text-white"
            style={{ fontFamily: 'Outfit_700Bold' }}
          >
            {isSignup ? 'Sign up' : 'Login'}
          </Text>

          <View className="h-11 w-11" />
        </View>
      </View>

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
          <View className="flex-1 px-5 pt-8">
        <Text
          className="text-3xl text-[#1B3B36]"
          style={{ fontFamily: 'Outfit_900Black' }}
        >
          {isSignup ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text
          className="mt-2 text-base text-slate-500"
          style={{ fontFamily: 'Outfit_500Medium' }}
        >
          {isSignup
            ? 'Sign up to add and share campus skate spots.'
            : 'Login to use your profile and add campus skate spots.'}
        </Text>

        <View className="mt-8 gap-4">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8E9AA6"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
            className="rounded-2xl bg-[#F0F3F5] pl-4 pr-5 py-4 text-base text-[#1B3B36]"
            style={{ fontFamily: 'Outfit_600SemiBold' }}
          />
          <View className="flex-row items-center rounded-2xl bg-[#F0F3F5] pr-3">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#8E9AA6"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!submitting}
              className="flex-1 pl-4 pr-5 py-4 text-base text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_600SemiBold' }}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              disabled={submitting}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color="#8E9AA6"
              />
            </Pressable>
          </View>

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
            onPress={handleSubmit}
            disabled={submitting}
            className={`mt-2 items-center justify-center rounded-2xl py-4 ${
              submitting ? 'bg-[#21473f]/60' : 'bg-[#21473f]'
            }`}
            accessibilityLabel={isSignup ? 'Sign up' : 'Login'}
            accessibilityRole="button"
          >
            <Text
              className="text-lg text-white"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              {submitting
                ? 'Please wait...'
                : isSignup
                  ? 'Sign up'
                  : 'Login'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setError('');
              setNotice('');
              setMode(isSignup ? 'login' : 'signup');
            }}
            disabled={submitting}
            className="items-center justify-center py-1"
            accessibilityRole="button"
          >
            <Text
              className="text-base text-slate-500"
              style={{ fontFamily: 'Outfit_600SemiBold' }}
            >
              {isSignup
                ? 'Already have an account? Login'
                : "Don't have an account? Sign up"}
            </Text>
          </Pressable>

          <View className="flex-row items-center">
            <View className="h-px flex-1 bg-slate-200" />
            <Text
              className="mx-3 text-sm text-slate-400"
              style={{ fontFamily: 'Outfit_600SemiBold' }}
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

          {/* TODO: Sign in with Apple - to be implemented later */}
          {/* <Pressable
            className="items-center justify-center rounded-2xl border border-slate-200 py-4"
            accessibilityLabel="Sign in with Apple"
            accessibilityRole="button"
          >
            <Text
              className="text-base text-[#1B3B36]"
              style={{ fontFamily: 'Outfit_700Bold' }}
            >
              Sign in with Apple
            </Text>
          </Pressable> */}
        </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
