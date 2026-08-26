import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

export function applyCrashReportingUpdateContext(): void {
  try {
    if (!Updates.isEnabled) {
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
