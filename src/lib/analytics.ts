import { createElement, type ComponentType, type ReactNode } from 'react';
import { Platform } from 'react-native';
import PostHog, { PostHogProvider } from 'posthog-react-native';

export type AnalyticsProperties = Record<string, string | number | boolean>;
export type AuthMethod = 'email' | 'google' | 'apple';

const RECENT_USER_WINDOW_MS = 120_000;

let client: PostHog | null = null;

function readApiKey(): string {
  return process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() ?? '';
}

function readHost(): string {
  return process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() ?? '';
}

function reportMissingConfiguration(variable: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    throw new Error(
      `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`
    );
  }
}

export function isAnalyticsEnabled(): boolean {
  const apiKey = readApiKey();
  const host = readHost();

  if (!apiKey) {
    reportMissingConfiguration('EXPO_PUBLIC_POSTHOG_API_KEY');
    return false;
  }

  if (!host) {
    reportMissingConfiguration('EXPO_PUBLIC_POSTHOG_HOST');
    return false;
  }

  return Platform.OS !== 'web';
}

export function getAnalyticsClient(): PostHog | null {
  if (!isAnalyticsEnabled()) {
    return null;
  }

  if (!client) {
    client = new PostHog(readApiKey(), {
      host: readHost(),
      captureAppLifecycleEvents: true,
    });
  }

  return client;
}

export function captureAnalyticsEvent(
  event: string,
  properties?: AnalyticsProperties
): void {
  getAnalyticsClient()?.capture(event, properties);
}

export function captureAnalyticsScreen(name: string): void {
  if (!name) {
    return;
  }

  getAnalyticsClient()?.screen(name);
}

export function identifyAnalyticsUser(
  userId: string,
  personProperties?: { email?: string }
): void {
  if (!userId) {
    return;
  }

  getAnalyticsClient()?.identify(userId, personProperties);
}

export function resetAnalyticsUser(): void {
  getAnalyticsClient()?.reset();
}

export function isRecentlyCreatedUser(
  createdAt: string | undefined,
  now = Date.now()
): boolean {
  if (!createdAt) {
    return false;
  }

  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return false;
  }

  return now - created < RECENT_USER_WINDOW_MS;
}

export function captureAuthCompleted(
  kind: 'login' | 'signup',
  method: AuthMethod
): void {
  captureAnalyticsEvent(
    kind === 'signup' ? 'signup_completed' : 'login_completed',
    { method }
  );
}

export function captureOauthAuthCompleted(
  createdAt: string | undefined,
  method: Extract<AuthMethod, 'google' | 'apple'>
): void {
  captureAuthCompleted(
    isRecentlyCreatedUser(createdAt) ? 'signup' : 'login',
    method
  );
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const analyticsClient = getAnalyticsClient();
  if (!analyticsClient) {
    return children;
  }

  const Provider = PostHogProvider as ComponentType<{
    client: PostHog;
    style: { flex: number };
    children?: ReactNode;
  }>;

  return createElement(
    Provider,
    { client: analyticsClient, style: { flex: 1 } },
    children
  );
}
