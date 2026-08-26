import Constants from 'expo-constants';
import { Platform } from 'react-native';

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function extraApiUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { apiUrl?: unknown }
    | undefined;
  return typeof extra?.apiUrl === 'string' ? extra.apiUrl : undefined;
}

// Resolves a relative API path ("/api/...") to a full URL that works across
// web, Expo Go, and standalone builds.
export function getApiUrl(path: string) {
  const resolvedUrl =
    process.env.EXPO_PUBLIC_API_URL?.trim() || extraApiUrl()?.trim();

  if (resolvedUrl) {
    if (Platform.OS !== 'web' && !isAbsoluteUrl(resolvedUrl)) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must be an absolute URL on native platforms.'
      );
    }

    return `${resolvedUrl.replace(/\/$/, '')}${path}`;
  }

  if (Platform.OS === 'web') {
    return path;
  }

  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    return `http://${hostUri}${path}`;
  }

  throw new Error(
    'Missing API URL for native platforms. Set EXPO_PUBLIC_API_URL to an absolute URL or run through Expo with a host URI.'
  );
}
