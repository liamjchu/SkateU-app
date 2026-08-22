import type { ComponentType } from 'react';
import * as Sentry from '@sentry/react-native';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '';

export function initCrashReporting(): void {
  if (!sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export function wrapRoot(Root: ComponentType): ComponentType {
  if (!sentryDsn) {
    return Root;
  }

  return Sentry.wrap(Root as ComponentType<Record<string, unknown>>);
}
