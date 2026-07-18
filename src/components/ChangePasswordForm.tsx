import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PASSWORD_REQUIREMENTS, validatePassword } from '../lib/password';
import { changePassword } from '../lib/password-change';

type ChangePasswordFormProps = {
  email: string;
};

type PasswordFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
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

  return 'We could not update your password right now. Please try again.';
};

function PasswordField({
  value,
  onChangeText,
  placeholder,
  autoComplete,
  visible,
  onToggleVisibility,
  editable,
}: PasswordFieldProps) {
  return (
    <View className="flex-row items-center rounded-2xl bg-[#F0F3F5] pr-3">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8E9AA6"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        editable={editable}
        className="flex-1 pl-4 pr-5 py-4 font-outfit-semibold text-base text-[#1B3B36]"
      />
      <Pressable
        onPress={onToggleVisibility}
        disabled={!editable}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={visible ? `Hide ${placeholder}` : `Show ${placeholder}`}
      >
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={22}
          color="#8E9AA6"
        />
      </Pressable>
    </View>
  );
}

export default function ChangePasswordForm({ email }: ChangePasswordFormProps) {
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
      setError('You must be signed in to change your password.');
      return;
    }
    if (!currentPassword) {
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
      await changePassword({ email, currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Your password has been updated.');
    } catch (changeError) {
      setError(getChangePasswordErrorMessage(changeError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <Text className="font-outfit-black text-2xl text-[#1B3B36]">
          Change password
        </Text>
        <Text className="mt-2 font-outfit-medium text-base text-slate-500">
          Verify your current password before choosing a new one.
        </Text>
        <Text className="mt-2 font-outfit-medium text-sm text-slate-400">
          {PASSWORD_REQUIREMENTS}
        </Text>
      </View>

      <PasswordField
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Current password"
        autoComplete="current-password"
        visible={showCurrentPassword}
        onToggleVisibility={() => setShowCurrentPassword((visible) => !visible)}
        editable={!submitting}
      />
      <PasswordField
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New password"
        autoComplete="new-password"
        visible={showNewPassword}
        onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
        editable={!submitting}
      />
      <PasswordField
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm new password"
        autoComplete="new-password"
        visible={showConfirmation}
        onToggleVisibility={() => setShowConfirmation((visible) => !visible)}
        editable={!submitting}
      />

      {error ? (
        <Text selectable className="font-outfit-medium text-sm text-red-500">
          {error}
        </Text>
      ) : null}

      {success ? (
        <View className="rounded-2xl bg-[#EBF2F0] px-4 py-3">
          <Text selectable className="font-outfit-semibold text-sm text-[#1B3B36]">
            {success}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        className={`items-center justify-center rounded-2xl py-4 ${
          submitting ? 'bg-[#21473f]/60' : 'bg-[#21473f]'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Update password"
      >
        <Text className="font-outfit-bold text-lg text-white">
          {submitting ? 'Updating password...' : 'Update password'}
        </Text>
      </Pressable>
    </View>
  );
}
