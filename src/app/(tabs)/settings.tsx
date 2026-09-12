import { Feather } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackPressable from '../../components/FeedbackPressable';
import { colors } from '../../constants/colors';
import { userCanSignInWithPassword } from '../../lib/authAccount';
import { LEGAL_APP_ROUTES } from '../../lib/legalAcceptance';
import { guardedNavigate, useGuardedRouter } from '../../lib/navigationGuard';
import { toUserFacingError } from '../../lib/userFacingError';
import { useAuthStore } from '../../store/authStore';

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
      pressLockMs={700}
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

function SettingsSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={className}>
      {title ? (
        <Text className="mb-2 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-2xl bg-field">{children}</View>
    </View>
  );
}

function SettingsRows({ rows }: { rows: SettingsRowProps[] }) {
  return (
    <>
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? <View className="ml-16 h-px bg-border-soft" /> : null}
          <SettingsRow {...row} />
        </View>
      ))}
    </>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const user = useAuthStore((state) => state.user);
  const signedIn = Boolean(user?.id);
  const email = user?.email ?? '';
  const canSignInWithPassword = userCanSignInWithPassword(user);
  const signOut = useAuthStore((state) => state.signOut);
  const sendDeleteAccountOtp = useAuthStore(
    (state) => state.sendDeleteAccountOtp
  );

  const [loggingOut, setLoggingOut] = useState(false);
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);

  const performLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      Alert.alert(
        'Couldn’t log out',
        toUserFacingError(error, 'Please try again.')
      );
      setLoggingOut(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can log back in anytime.', [
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
        toUserFacingError(error, 'Please try again.')
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
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-5"
        showsVerticalScrollIndicator={false}
      >
        <Text
          accessibilityRole="header"
          className="mb-5 px-1 font-outfit-black text-3xl text-ink"
        >
          Settings
        </Text>

        <SettingsSection title="Account">
          {signedIn ? (
            <SettingsRows
              rows={[
                {
                  icon: 'user',
                  label: 'Change username',
                  showChevron: true,
                  onPress: () => router.push('/change-username'),
                  accessibilityHint: 'Opens the username editor',
                },
                {
                  icon: 'edit-3',
                  label: 'Edit bio',
                  showChevron: true,
                  onPress: () => router.push('/edit-bio'),
                  accessibilityHint: 'Opens the profile bio editor',
                },
                {
                  icon: 'lock',
                  label: canSignInWithPassword
                    ? 'Change password'
                    : 'Set a password',
                  showChevron: true,
                  onPress: () => router.push('/change-password'),
                  accessibilityHint: canSignInWithPassword
                    ? 'Opens the password editor'
                    : 'Opens the form to add a password to this account',
                },
                {
                  icon: 'bell',
                  label: 'Notifications',
                  showChevron: true,
                  onPress: () => router.push('/notification-settings'),
                  accessibilityHint: 'Opens notification settings',
                },
                {
                  icon: 'slash',
                  label: 'Blocked accounts',
                  showChevron: true,
                  onPress: () => router.push('/blocked-accounts'),
                  accessibilityHint: 'Opens the list of skaters you blocked',
                },
              ]}
            />
          ) : (
            <SettingsRows
              rows={[
                {
                  icon: 'user-plus',
                  label: 'Sign up',
                  showChevron: true,
                  onPress: () => {
                    guardedNavigate('signup', () => {
                      router.push('/signup');
                    });
                  },
                  accessibilityHint: 'Opens the sign up screen',
                },
                {
                  icon: 'log-in',
                  label: 'Log in',
                  showChevron: true,
                  onPress: () => {
                    guardedNavigate('login', () => {
                      router.push('/login');
                    });
                  },
                  accessibilityHint: 'Opens the log in screen',
                },
              ]}
            />
          )}
        </SettingsSection>

        <SettingsSection title="Support" className="mt-8">
          <SettingsRows
            rows={[
              {
                icon: 'help-circle',
                label: 'Help & Support',
                showChevron: true,
                onPress: () => router.push('/help'),
                accessibilityHint: 'Opens Help and Support',
              },
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Legal" className="mt-8">
          <SettingsRows
            rows={[
              {
                icon: 'file-text',
                label: 'Terms of Use',
                showChevron: true,
                onPress: () => router.push(LEGAL_APP_ROUTES.terms),
                accessibilityHint: 'Opens the Terms of Use',
              },
              {
                icon: 'shield',
                label: 'Privacy Policy',
                showChevron: true,
                onPress: () => router.push(LEGAL_APP_ROUTES.privacy),
                accessibilityHint: 'Opens the Privacy Policy',
              },
              {
                icon: 'users',
                label: 'Community Guidelines',
                showChevron: true,
                onPress: () => router.push(LEGAL_APP_ROUTES.communityGuidelines),
                accessibilityHint: 'Opens the Community Guidelines',
              },
            ]}
          />
        </SettingsSection>

        {signedIn ? (
          <>
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
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
