import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import FeedbackPressable from '../components/FeedbackPressable';
import ScreenHeader from '../components/screen-header';
import { colors } from '../constants/colors';
import { useGuardedRouter } from '../lib/navigationGuard';
import {
  getOsNotificationPermission,
  registerPushToken,
  requestOsNotificationPermission,
  type OsNotificationPermission,
} from '../lib/pushRegistration';
import { toUserFacingError } from '../lib/userFacingError';
import { useAuthStore } from '../store/authStore';
import { useNotificationPreferencesStore } from '../store/notificationPreferencesStore';
import type { NotificationPreferences } from '../lib/notificationPreferences';

type PrefKey = keyof NotificationPreferences;

function SettingsSwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="min-h-14 flex-row items-center px-4 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft">
        <Feather name={icon} size={16} color={colors.ink} />
      </View>
      <View className="ml-3 min-w-0 flex-1 pr-3">
        <Text className="font-outfit-semibold text-base text-ink">{label}</Text>
        {description ? (
          <Text className="mt-0.5 font-outfit-medium text-sm text-muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderSoft, true: colors.accent }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.borderSoft}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useGuardedRouter();
  const accessToken = useAuthStore(
    (state) => state.session?.access_token ?? null
  );
  const preferences = useNotificationPreferencesStore(
    (state) => state.preferences
  );
  const error = useNotificationPreferencesStore((state) => state.error);
  const fetchPreferences = useNotificationPreferencesStore(
    (state) => state.fetchPreferences
  );
  const updatePreferences = useNotificationPreferencesStore(
    (state) => state.updatePreferences
  );
  const [osPermission, setOsPermission] =
    useState<OsNotificationPermission>('undetermined');
  const [busyKey, setBusyKey] = useState<PrefKey | null>(null);

  useEffect(() => {
    if (accessToken) {
      void fetchPreferences(accessToken);
    }
    void getOsNotificationPermission().then(setOsPermission);
  }, [accessToken, fetchPreferences]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/settings');
  };

  const savePref = async (patch: Partial<NotificationPreferences>) => {
    if (!accessToken) {
      return;
    }
    const key = (Object.keys(patch)[0] ?? 'pushEnabled') as PrefKey;
    setBusyKey(key);
    try {
      await updatePreferences(patch, accessToken);
    } catch (caught) {
      Alert.alert(
        'Couldn’t save that',
        toUserFacingError(caught, 'Please try again.')
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleMasterChange = async (enabled: boolean) => {
    if (!accessToken || Platform.OS === 'web') {
      return;
    }
    if (!enabled) {
      await savePref({ pushEnabled: false });
      return;
    }

    const permission = await requestOsNotificationPermission();
    setOsPermission(permission);
    if (permission !== 'granted') {
      Alert.alert(
        'Notifications are off',
        'Turn on notifications for SkateU in Settings to get likes, comments, and campus alerts.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ]
      );
      return;
    }

    try {
      await registerPushToken(accessToken);
      await savePref({ pushEnabled: true });
    } catch (caught) {
      Alert.alert(
        'Couldn’t enable notifications',
        toUserFacingError(caught, 'Please try again.')
      );
    }
  };

  const categoriesDisabled =
    Platform.OS === 'web' ||
    osPermission !== 'granted' ||
    !preferences.pushEnabled ||
    busyKey !== null;

  const masterOn =
    Platform.OS !== 'web' &&
    osPermission === 'granted' &&
    preferences.pushEnabled;

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Notifications" onBack={goBack} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="self-center w-full max-w-[640px] px-6 pb-8 pt-6"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View className="mb-4 rounded-2xl border border-errorBorder bg-errorSurface px-4 py-4">
            <Text
              accessibilityRole="alert"
              className="font-outfit-medium text-base text-errorText"
            >
              {error}
            </Text>
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <Text className="mb-4 px-1 font-outfit-medium text-base text-muted">
            Push notifications are available in the iOS and Android apps. Your
            in-app inbox still works here.
          </Text>
        ) : null}

        <Text className="mb-2 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
          Push
        </Text>
        <View className="overflow-hidden rounded-2xl bg-field">
          <SettingsSwitchRow
            icon="bell"
            label="Push notifications"
            description="Alerts when you’re not in the app"
            value={masterOn}
            disabled={Platform.OS === 'web' || busyKey !== null}
            onValueChange={(value) => {
              void handleMasterChange(value);
            }}
          />
        </View>

        {Platform.OS !== 'web' && osPermission === 'denied' ? (
          <View className="mt-3 px-1">
            <Text className="font-outfit-medium text-sm text-muted">
              Notifications are turned off for SkateU on this device.
            </Text>
            <FeedbackPressable
              onPress={() => {
                void Linking.openSettings();
              }}
              className="mt-2 self-start"
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
            >
              <Text className="font-outfit-semibold text-base text-accent">
                Open Settings
              </Text>
            </FeedbackPressable>
          </View>
        ) : null}

        <Text className="mb-2 mt-8 px-1 font-outfit-bold text-xs uppercase tracking-wide text-muted">
          What you get
        </Text>
        <View className="overflow-hidden rounded-2xl bg-field">
          <SettingsSwitchRow
            icon="heart"
            label="Likes, comments, and follows"
            value={preferences.notifySocial}
            disabled={categoriesDisabled}
            onValueChange={(value) => {
              void savePref({ notifySocial: value });
            }}
          />
          <View className="ml-16 h-px bg-border-soft" />
          <SettingsSwitchRow
            icon="map-pin"
            label="Saved schools and liked spots"
            description="New spots at campuses you save, and comments on spots you liked"
            value={preferences.notifyCampus}
            disabled={categoriesDisabled}
            onValueChange={(value) => {
              void savePref({ notifyCampus: value });
            }}
          />
          <View className="ml-16 h-px bg-border-soft" />
          <SettingsSwitchRow
            icon="flag"
            label="Your spots"
            description="When a spot you added is approved, under review, or removed"
            value={preferences.notifySpotUpdates}
            disabled={categoriesDisabled}
            onValueChange={(value) => {
              void savePref({ notifySpotUpdates: value });
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
