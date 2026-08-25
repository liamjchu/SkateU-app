import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '';

function applyUpdateContext(): void {
  if (!sentryDsn) {
    return;
  }

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

export function initCrashReporting(): void {
  if (!sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
  applyUpdateContext();
}

export function setCrashReportingUser(userId: string): void {
  if (!sentryDsn || !userId) {
    return;
  }

  Sentry.setUser({ id: userId });
}

export function clearCrashReportingUser(): void {
  if (!sentryDsn) {
    return;
  }

  Sentry.setUser(null);
}

export function wrapRoot(Root: ComponentType): ComponentType {
  if (!sentryDsn) {
    return Root;
  }

  return Sentry.wrap(Root as ComponentType<Record<string, unknown>>);
}
