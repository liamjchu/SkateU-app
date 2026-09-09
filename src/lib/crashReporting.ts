import * as Sentry from '@sentry/react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type UpdatesModule = {
  isEnabled?: boolean;
  updateId?: string | null;
  channel?: string | null;
  runtimeVersion?: string | null;
};

function getUpdates(): UpdatesModule | null {
  if (
    requireOptionalNativeModule('ExpoUpdates') == null &&
    process.env.NODE_ENV !== 'test'
  ) {
    return null;
  }

  try {
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

export function applyCrashReportingUpdateContext(): void {
  try {
    const Updates = getUpdates();
    if (!Updates?.isEnabled) {
      return;
    }

    Sentry.setTag('updateId', Updates.updateId ?? 'embedded');
    if (Updates.channel) {
      Sentry.setTag('channel', Updates.channel);
    }
    if (Updates.runtimeVersion) {
      Sentry.setTag('runtimeVersion', Updates.runtimeVersion);
    }
  } catch {
    // expo-updates is unavailable in some runtimes (web, tests, Expo Go).
  }
}

export function setCrashReportingUser(userId: string): void {
  if (!userId) {
    return;
  }

  Sentry.setUser({ id: userId });
}

export function clearCrashReportingUser(): void {
  Sentry.setUser(null);
}
