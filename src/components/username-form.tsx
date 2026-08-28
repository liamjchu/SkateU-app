import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { USERNAME_MAX, validateUsername } from '../lib/username';
import { colors } from '../constants/colors';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import FeedbackPressable from './FeedbackPressable';

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
  submitEnabled?: boolean;
  footer?: ReactNode;
  onBeforeSubmit?: () => Promise<void>;
  onSaved: () => void;
};

export function UsernameForm({
  initialUsername,
  currentUsername,
  submitLabel,
  submittingLabel,
  showWelcomeOnSave = false,
  submitEnabled = true,
  footer,
  onBeforeSubmit,
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

  const fieldsReady =
    status === 'available' &&
    Boolean(accessToken) &&
    !submitting &&
    !unchanged;
  const canSubmit = fieldsReady && submitEnabled;

  const handleSubmit = async () => {
    if (!accessToken || !fieldsReady) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await onBeforeSubmit?.();
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
      setSubmitError(
        toUserFacingError(error, 'Could not save the username. Try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="mt-8">
      <View className="min-h-14 flex-row items-center rounded-2xl border border-border-soft bg-field pl-5 pr-3">
        <Text className="font-outfit-bold text-base text-muted">@</Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder="username"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Username"
          accessibilityHint="Enter a username using letters, numbers, and underscores"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={USERNAME_MAX}
          editable={!submitting}
          className="flex-1 pl-1 pr-2 font-outfit-semibold text-base text-ink"
          style={{ paddingVertical: 0, textAlignVertical: 'center' }}
        />
        <View className="h-6 w-6 items-center justify-center">
          {status === 'checking' ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : status === 'available' ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
          ) : status === 'taken' || status === 'invalid' || status === 'rejected' ? (
            <Ionicons name="close-circle" size={22} color={colors.errorText} />
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
          <Text className="font-outfit-medium text-sm text-errorText">
            {submitError}
          </Text>
        ) : unchanged ? (
          <Text className="font-outfit-medium text-sm text-muted">
            That&apos;s your current username.
          </Text>
        ) : status === 'invalid' && validationError ? (
          <Text className="font-outfit-medium text-sm text-errorText">
            {validationError}
          </Text>
        ) : status === 'taken' ? (
          <Text className="font-outfit-medium text-sm text-errorText">
            That username is already taken.
          </Text>
        ) : status === 'available' ? (
          <Text className="font-outfit-semibold text-sm text-ink">
            Nice — that one&apos;s available.
          </Text>
        ) : status === 'error' ? (
          <Text className="font-outfit-medium text-sm text-muted">
            Couldn&apos;t check right now. Try again.
          </Text>
        ) : null}
      </View>

      {footer ? <View className="mt-6">{footer}</View> : null}

      <FeedbackPressable
        haptic="light"
        onPress={handleSubmit}
        disabled={submitting || !fieldsReady}
        className={`mt-6 min-h-14 w-full items-center justify-center rounded-2xl py-4 ${
          canSubmit ? 'bg-accent' : 'bg-actionDisabled'
        }`}
        accessibilityLabel={submitting ? submittingLabel : submitLabel}
        accessibilityRole="button"
        accessibilityState={{
          disabled: submitting || !fieldsReady,
          busy: submitting,
        }}
      >
        <Text
          className={`font-outfit-bold text-lg ${canSubmit ? 'text-brand' : 'text-muted'}`}
        >
          {submitting ? submittingLabel : submitLabel}
        </Text>
      </FeedbackPressable>
    </View>
  );
}
