import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { validateUsername } from '../lib/username';
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

type UsernameFormProps = {
  initialUsername: string;
  currentUsername?: string;
  submitLabel: string;
  submittingLabel: string;
  showWelcomeOnSave?: boolean;
  onSaved: () => void;
};

export function UsernameForm({
  initialUsername,
  currentUsername,
  submitLabel,
  submittingLabel,
  showWelcomeOnSave = false,
  onSaved,
}: UsernameFormProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const isUsernameAvailable = useProfileStore(
    (state) => state.isUsernameAvailable
  );
  const claimUsername = useProfileStore((state) => state.claimUsername);

  const [value, setValue] = useState(initialUsername);
  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validationError = value.length > 0 ? validateUsername(value) : null;
  const unchanged = currentUsername !== undefined && value === currentUsername;

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
        const available = await isUsernameAvailable(value, userId);
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
  }, [isUsernameAvailable, userId, validationError, value]);

  const handleChange = (text: string) => {
    setSubmitError('');
    setValue(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  const canSubmit = status === 'available' && !submitting && !unchanged;

  const handleSubmit = async () => {
    if (!accessToken || !canSubmit) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await claimUsername(
        accessToken,
        value,
        showWelcomeOnSave
      );

      if (!result.ok) {
        setStatus(result.taken ? 'taken' : 'rejected');
        setSubmitError(result.message);
        return;
      }

      onSaved();
    } catch (error) {
      setStatus('error');
      setSubmitError(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'Could not save the username. Try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="mt-8">
      <View className="flex-row items-center rounded-2xl bg-[#F0F3F5] pl-4 pr-3">
        <Text className="font-outfit-bold text-base text-slate-400">@</Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="username"
          accessibilityLabel="Username"
          accessibilityHint="Enter a username using letters, numbers, and underscores"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={20}
          editable={!submitting}
          className="flex-1 py-4 pl-1 pr-2 font-outfit-semibold text-base text-[#1B3B36]"
        />
        <View className="h-6 w-6 items-center justify-center">
          {status === 'checking' ? (
            <ActivityIndicator size="small" color="#52645F" />
          ) : status === 'available' ? (
            <Ionicons name="checkmark-circle" size={22} color="#1B3B36" />
          ) : status === 'taken' || status === 'invalid' || status === 'rejected' ? (
            <Ionicons name="close-circle" size={22} color="#7F302C" />
          ) : null}
        </View>
      </View>

      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="mt-2 min-h-[20px] px-1"
      >
        {submitError ? (
          <Text className="font-outfit-medium text-sm text-[#7F302C]">
            {submitError}
          </Text>
        ) : unchanged ? (
          <Text className="font-outfit-medium text-sm text-slate-400">
            That&apos;s your current username.
          </Text>
        ) : status === 'invalid' && validationError ? (
          <Text className="font-outfit-medium text-sm text-[#7F302C]">
            {validationError}
          </Text>
        ) : status === 'taken' ? (
          <Text className="font-outfit-medium text-sm text-[#7F302C]">
            That username is already taken.
          </Text>
        ) : status === 'available' ? (
          <Text className="font-outfit-semibold text-sm text-[#1B3B36]">
            Nice — that one&apos;s available.
          </Text>
        ) : status === 'error' ? (
          <Text className="font-outfit-medium text-sm text-slate-400">
            Couldn&apos;t check right now. Try again.
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        className={`mt-6 w-full items-center justify-center rounded-2xl py-4 ${
          canSubmit ? 'bg-[#21473f]' : 'bg-[#60756F]'
        }`}
        accessibilityLabel={submitting ? submittingLabel : submitLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy: submitting }}
      >
        <Text className="font-outfit-bold text-lg text-white">
          {submitting ? submittingLabel : submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}
