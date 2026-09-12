import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getApiUrl } from './api';

const ANDROID_CHANNEL_ID = 'default';

let registeredToken: string | null = null;
let handlerConfigured = false;

function easProjectId(): string | null {
  const easConfig = Constants.easConfig as { projectId?: unknown } | null;
  if (typeof easConfig?.projectId === 'string' && easConfig.projectId.length > 0) {
    return easConfig.projectId;
  }
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: unknown } }
    | undefined;
  const extraId = extra?.eas?.projectId;
  return typeof extraId === 'string' && extraId.length > 0 ? extraId : null;
}

export function configurePushNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === 'web') {
    return;
  }
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'SkateU',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export type OsNotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getOsNotificationPermission(): Promise<OsNotificationPermission> {
  if (Platform.OS === 'web') {
    return 'denied';
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return 'granted';
  }
  if (existing.canAskAgain) {
    return 'undetermined';
  }
  return 'denied';
}

export async function requestOsNotificationPermission(): Promise<OsNotificationPermission> {
  if (Platform.OS === 'web') {
    return 'denied';
  }
  const current = await getOsNotificationPermission();
  if (current !== 'undetermined') {
    return current;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

async function fetchExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }
  const projectId = easProjectId();
  if (!projectId) {
    return null;
  }
  await ensureAndroidChannel();
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return result.data;
}

export async function registerPushToken(accessToken: string): Promise<string | null> {
  configurePushNotificationHandler();
  const permission = await getOsNotificationPermission();
  if (permission !== 'granted') {
    return null;
  }

  const token = await fetchExpoPushToken();
  if (!token) {
    return null;
  }

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const response = await fetch(getApiUrl('/api/push-tokens'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, platform }),
  });
  if (!response.ok) {
    throw new Error('Couldn’t save that push token right now.');
  }
  registeredToken = token;
  return token;
}

export async function unregisterStoredPushToken(
  accessToken: string | null
): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token || !accessToken || Platform.OS === 'web') {
    return;
  }
  try {
    await fetch(
      getApiUrl(`/api/push-tokens?token=${encodeURIComponent(token)}`),
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch {
    // Logout should continue even if token cleanup fails.
  }
}

export function getRegisteredPushToken(): string | null {
  return registeredToken;
}

export function parsePushNotificationData(value: unknown): {
  type: string | null;
  spotId: string | null;
  spotName: string | null;
  userId: string | null;
} {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { type: null, spotId: null, spotName: null, userId: null };
  }
  const record = value as Record<string, unknown>;
  return {
    type: typeof record.type === 'string' ? record.type : null,
    spotId: typeof record.spotId === 'string' ? record.spotId : null,
    spotName: typeof record.spotName === 'string' ? record.spotName : null,
    userId: typeof record.userId === 'string' ? record.userId : null,
  };
}
