import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '../constants/colors';
import { PASSWORD_REQUIREMENTS, validatePassword } from '../lib/password';
import { changePassword, setPassword } from '../lib/password-change';
import FeedbackPressable from './FeedbackPressable';

type ChangePasswordFormProps = {
  email: string;
  mode?: 'change' | 'set';
};

type PasswordFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  visible: boolean;
  onToggleVisibility: () => void;
  editable: boolean;
};

const getChangePasswordErrorMessage = (changeError: unknown): string => {
  const message = changeError instanceof Error ? changeError.message : '';

  if (message === 'Incorrect current password.') {
    return message;
  }
  if (/network|fetch|internet/i.test(message)) {
    return 'Check your internet connection and try again.';
  }

  return 'We couldn’t update your password right now. Please try again.';
};

function PasswordField({
  value,
  onChangeText,
  label,
  placeholder,
  autoComplete,
  visible,
  onToggleVisibility,
  editable,
}: PasswordFieldProps) {
  return (
    <View className="flex-row items-center rounded-2xl border border-border-soft bg-field pl-5 pr-2">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        accessibilityHint="Enter your password"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        editable={editable}
        className="flex-1 py-4 font-outfit-semibold text-base text-ink"
        style={{ padding: 0 }}
      />
      <Pressable
        onPress={onToggleVisibility}
        disabled={!editable}
        hitSlop={8}
        className="h-12 w-12 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
      >
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={22}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
}

export default function ChangePasswordForm({
  email,
  mode = 'change',
}: ChangePasswordFormProps) {
  const isSetMode = mode === 'set';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (!email) {
      setError('Sign in to update your password.');
      return;
    }
    if (!isSetMode && !currentPassword) {
      setError('Enter your current password.');
      return;
    }

    // Reuse the same shared policy used by the password-recovery screen.
    const newPasswordError = validatePassword(newPassword);
    if (newPasswordError) {
      setError(newPasswordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (isSetMode) {
        await setPassword(newPassword);
      } else {
        await changePassword({ email, currentPassword, newPassword });
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(
        isSetMode
          ? 'Your password has been set. You can now also sign in with email.'
          : 'Your password has been updated.'
      );
    } catch (changeError) {
      setError(getChangePasswordErrorMessage(changeError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <Text className="font-outfit-black text-2xl text-ink">
          {isSetMode ? 'Set a password' : 'Change password'}
        </Text>
        <Text className="mt-2 font-outfit-medium text-base text-muted">
          {isSetMode
            ? 'Add an email password to this account. Your Google or Apple sign-in will keep working.'
            : 'Verify your current password before choosing a new one.'}
        </Text>
        <Text className="mt-2 font-outfit-medium text-sm text-muted">
          {PASSWORD_REQUIREMENTS}
        </Text>
      </View>

      {isSetMode ? null : (
        <PasswordField
          value={currentPassword}
          onChangeText={setCurrentPassword}
          label="Current password"
          placeholder="Current password"
          autoComplete="current-password"
          visible={showCurrentPassword}
          onToggleVisibility={() => setShowCurrentPassword((visible) => !visible)}
          editable={!submitting}
        />
      )}
      <PasswordField
        value={newPassword}
        onChangeText={setNewPassword}
        label="New password"
        placeholder="New password"
        autoComplete="new-password"
        visible={showNewPassword}
        onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
        editable={!submitting}
      />
      <PasswordField
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        label="Confirm new password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        visible={showConfirmation}
        onToggleVisibility={() => setShowConfirmation((visible) => !visible)}
        editable={!submitting}
      />

      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          selectable
          className="font-outfit-medium text-sm text-errorText"
        >
          {error}
        </Text>
      ) : null}

      {success ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="rounded-2xl bg-field px-4 py-3"
        >
          <Text selectable className="font-outfit-semibold text-sm text-ink">
            {success}
          </Text>
        </View>
      ) : null}

      <FeedbackPressable
        haptic="light"
        onPress={handleSubmit}
        disabled={submitting}
        className={`min-h-14 items-center justify-center rounded-2xl py-4 ${
          submitting ? 'bg-actionDisabled' : 'bg-accent'
        }`}
        accessibilityRole="button"
        accessibilityLabel={
          submitting
            ? isSetMode
              ? 'Setting password'
              : 'Updating password'
            : isSetMode
              ? 'Set password'
              : 'Update password'
        }
        accessibilityState={{ disabled: submitting, busy: submitting }}
      >
        <Text
          className={`font-outfit-bold text-lg ${submitting ? 'text-muted' : 'text-brand'}`}
        >
          {submitting
            ? isSetMode
              ? 'Setting password…'
              : 'Updating password…'
            : isSetMode
              ? 'Set password'
              : 'Update password'}
        </Text>
      </FeedbackPressable>
    </View>
  );
}
