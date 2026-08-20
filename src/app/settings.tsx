import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import { LEGAL_APP_ROUTES } from '../lib/legalAcceptance';
import { toUserFacingError } from '../lib/userFacingError';
import { colors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

type SettingsRowProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  showChevron?: boolean;
};

function SettingsRow({
  icon,
  label,
  onPress,
  accessibilityHint,
  destructive = false,
  disabled = false,
  busy = false,
  showChevron = false,
}: SettingsRowProps) {
  const iconColor = destructive ? colors.errorText : colors.ink;
  const labelClass = destructive
    ? 'font-outfit-semibold text-base text-errorText'
    : 'font-outfit-semibold text-base text-ink';

  return (
    <FeedbackPressable
      haptic={destructive ? 'warning' : 'selection'}
      onPress={onPress}
      disabled={disabled}
      className="min-h-14 flex-row items-center px-4 py-3"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy }}
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          destructive ? 'bg-field' : 'bg-surface-soft'
        }`}
      >
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text className={`ml-3 flex-1 ${labelClass}`}>{label}</Text>
      {showChevron ? (
        <Feather name="chevron-right" size={18} color={colors.muted} />
      ) : null}
    </FeedbackPressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const email = useAuthStore((state) => state.user?.email ?? '');
  const signOut = useAuthStore((state) => state.signOut);
  const sendDeleteAccountOtp = useAuthStore(
    (state) => state.sendDeleteAccountOtp
  );

  const [loggingOut, setLoggingOut] = useState(false);
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/profile');
  };

  const performLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      console.warn('Failed to log out', error);
      Alert.alert(
        'Couldn’t log out',
        toUserFacingError(error, 'Try again in a sec.')
      );
      setLoggingOut(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: performLogout },
    ]);
  };

  const performDeleteAccount = async () => {
    if (sendingDeleteOtp) {
      return;
    }

    if (!email) {
      Alert.alert(
        'Couldn’t delete account',
        'This account doesn’t have an email we can verify.'
      );
      return;
    }

    setSendingDeleteOtp(true);

    try {
      await sendDeleteAccountOtp(email);
      router.push({
        pathname: '/verify-delete-account',
        params: { email },
      });
    } catch (error) {
      Alert.alert(
        'Couldn’t send that code',
        toUserFacingError(error, 'Try again in a sec.')
      );
    } finally {
      setSendingDeleteOtp(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This wipes your account for good. Your spots stay up, just unlinked from you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDeleteAccount,
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Settings" onBack={goBack} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-2 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
          Account
        </Text>
        <View className="overflow-hidden rounded-2xl bg-field">
          <SettingsRow
            icon="user"
            label="Change username"
            showChevron
            onPress={() => router.push('/change-username')}
            accessibilityHint="Opens the username editor"
          />
          <View className="ml-16 h-px bg-border-soft" />
          <SettingsRow
            icon="lock"
            label="Change password"
            showChevron
            onPress={() => router.push('/change-password')}
            accessibilityHint="Opens the password editor"
          />
        </View>

        <Text className="mb-2 mt-8 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
          Support
        </Text>
        <View className="overflow-hidden rounded-2xl bg-field">
          <SettingsRow
            icon="help-circle"
            label="Help & Support"
            showChevron
            onPress={() => router.push('/help')}
            accessibilityHint="Opens Help and Support"
          />
        </View>

        <Text className="mb-2 mt-8 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
          Legal
        </Text>
        <View className="overflow-hidden rounded-2xl bg-field">
          <SettingsRow
            icon="file-text"
            label="Terms of Use"
            showChevron
            onPress={() => router.push(LEGAL_APP_ROUTES.terms)}
            accessibilityHint="Opens the Terms of Use"
          />
          <View className="ml-16 h-px bg-border-soft" />
          <SettingsRow
            icon="shield"
            label="Privacy Policy"
            showChevron
            onPress={() => router.push(LEGAL_APP_ROUTES.privacy)}
            accessibilityHint="Opens the Privacy Policy"
          />
          <View className="ml-16 h-px bg-border-soft" />
          <SettingsRow
            icon="users"
            label="Community Guidelines"
            showChevron
            onPress={() => router.push(LEGAL_APP_ROUTES.communityGuidelines)}
            accessibilityHint="Opens the Community Guidelines"
          />
        </View>

        <View className="mt-6 overflow-hidden rounded-2xl bg-field">
          <SettingsRow
            icon="log-out"
            label={loggingOut ? 'Logging out...' : 'Log out'}
            disabled={loggingOut}
            busy={loggingOut}
            onPress={handleLogout}
          />
        </View>

        <View className="mt-6 overflow-hidden rounded-2xl bg-errorSurface">
          <SettingsRow
            icon="trash-2"
            label={sendingDeleteOtp ? 'Sending code...' : 'Delete account'}
            destructive
            disabled={sendingDeleteOtp}
            busy={sendingDeleteOtp}
            onPress={handleDeleteAccount}
            accessibilityHint="Sends a verification code before deleting your account"
          />
        </View>
      </ScrollView>
    </View>
  );
}
