import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiUrl } from '../lib/api';
import { slugifyUsername, validateUsername } from '../lib/username';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

type AvailabilityStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'rejected'
  | 'error';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const signOut = useAuthStore((state) => state.signOut);
  const isUsernameAvailable = useProfileStore(
    (state) => state.isUsernameAvailable
  );
  const setUsername = useProfileStore((state) => state.setUsername);
  const clearProfile = useProfileStore((state) => state.clearProfile);

  // Bonus: seed the input with a slug of the OAuth display name, if any.
  const suggestedUsername = useMemo(() => {
    const meta = user?.user_metadata;
    const rawName =
      typeof meta?.full_name === 'string'
        ? meta.full_name
        : typeof meta?.name === 'string'
          ? meta.name
          : '';
    return slugifyUsername(rawName);
  }, [user]);

  const [value, setValue] = useState(suggestedUsername);
  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Apply the suggestion once it becomes available (metadata can arrive late).
  const appliedSuggestion = useRef(false);
  useEffect(() => {
    if (!appliedSuggestion.current && suggestedUsername) {
      appliedSuggestion.current = true;
      setValue(suggestedUsername);
    }
  }, [suggestedUsername]);

  const validationError = value.length > 0 ? validateUsername(value) : null;

  // Debounced, real-time availability check against public.profiles.
  useEffect(() => {
    if (value.length === 0) {
      setStatus('idle');
      return;
    }

    if (validationError) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');
    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(value);
        if (!cancelled) {
          setStatus(available ? 'available' : 'taken');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [value, validationError, isUsernameAvailable]);

  const handleChange = (text: string) => {
    setSubmitError('');
    // Keep input constrained to valid characters as the user types.
    setValue(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  const canSubmit = status === 'available' && !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      // AI content check (G-rated) before we commit the username. Runs on the
      // server so the OpenAI key is never in the client bundle.
      const response = await fetch(getApiUrl('/api/moderate-username'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: value }),
      });

      const data = (await response.json().catch(() => null)) as
        | { allowed?: boolean; reason?: string; error?: string }
        | null;

      if (!response.ok) {
        // Fail closed: don't save if we couldn't verify.
        setSubmitError(
          data?.error ?? 'Could not verify the username right now. Try again.'
        );
        setSubmitting(false);
        return;
      }

      if (!data?.allowed) {
        setStatus('rejected');
        setSubmitError(
          data?.reason ?? "That username isn't allowed. Please pick another."
        );
        setSubmitting(false);
        return;
      }

      await setUsername(user.id, value);
      // On success the profile store updates `username`, and the root gate
      // in _layout redirects into the app automatically.
    } catch (error) {
      const isDuplicateUsername =
        error instanceof Error &&
        error.message === 'That username is already taken.';
      setStatus(isDuplicateUsername ? 'taken' : 'error');
      setSubmitError(
        isDuplicateUsername
          ? 'That username is already taken.'
          : 'Could not save. Try again.'
      );
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      clearProfile();
      await signOut();
    } catch {
      // Ignore; the auth listener will settle state either way.
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View
        className="bg-[#21473f] px-6 pb-4"
        style={{
          paddingTop: insets.top + 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <Text
          className="font-outfit-bold text-2xl text-white"
        >
          Choose a username
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-5 pt-8">
          <Text
            className="font-outfit-black text-3xl text-[#1B3B36]"
          >
            One last step
          </Text>
          <Text
            className="mt-2 font-outfit-medium text-base text-slate-500"
          >
            Pick a unique username. This is how other skaters will see you —
            your email stays private.
          </Text>

          <View className="mt-8">
            <View className="flex-row items-center rounded-2xl bg-[#F0F3F5] pl-4 pr-3">
              <Text
                className="font-outfit-bold text-base text-slate-400"
              >
                @
              </Text>
              <TextInput
                value={value}
                onChangeText={handleChange}
                placeholder="username"
                placeholderTextColor="#8E9AA6"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={20}
                editable={!submitting}
                className="flex-1 py-4 pl-1 pr-2 font-outfit-semibold text-base text-[#1B3B36]"
              />
              <View className="h-6 w-6 items-center justify-center">
                {status === 'checking' ? (
                  <ActivityIndicator size="small" color="#8E9AA6" />
                ) : status === 'available' ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#1B3B36"
                  />
                ) : status === 'taken' ||
                  status === 'invalid' ||
                  status === 'rejected' ? (
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                ) : null}
              </View>
            </View>

            <View className="mt-2 min-h-[20px] px-1">
              {submitError ? (
                <Text className="font-outfit-medium text-sm text-red-500">
                  {submitError}
                </Text>
              ) : status === 'invalid' && validationError ? (
                <Text className="font-outfit-medium text-sm text-red-500">
                  {validationError}
                </Text>
              ) : status === 'taken' ? (
                <Text className="font-outfit-medium text-sm text-red-500">
                  That username is already taken.
                </Text>
              ) : status === 'available' ? (
                <Text
                  className="font-outfit-semibold text-sm text-[#1B3B36]"
                >
                  Nice — that one's available.
                </Text>
              ) : status === 'error' ? (
                <Text
                  className="font-outfit-medium text-sm text-slate-400"
                >
                  Couldn't check right now. Try again.
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View className="p-5 pb-6">
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`w-full items-center justify-center rounded-2xl py-4 ${
              canSubmit ? 'bg-[#21473f]' : 'bg-slate-300'
            }`}
            accessibilityLabel="Continue"
            accessibilityRole="button"
          >
            <Text
              className="font-outfit-bold text-lg text-white"
            >
              {submitting ? 'Saving...' : 'Continue'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            disabled={submitting}
            className="items-center justify-center py-3"
            accessibilityRole="button"
          >
            <Text
              className="font-outfit-semibold text-base text-slate-500"
            >
              Sign out
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
