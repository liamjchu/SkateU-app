import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApiUrl } from '../api';

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatform(os: 'ios' | 'web'): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  }
  if (platformDescriptor) {
    Object.defineProperty(Platform, 'OS', platformDescriptor);
  }
});

describe('getApiUrl', () => {
  it('uses a configured absolute API URL and removes one trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.skateu.test/';
    setPlatform('ios');
    expect(getApiUrl('/api/spots')).toBe('https://api.skateu.test/api/spots');
  });

  it('keeps relative paths on web when no API URL is configured', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setPlatform('web');
    expect(getApiUrl('/api/spots')).toBe('/api/spots');
  });

  it('rejects a relative API URL on native platforms', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http-relative-not-valid';
    setPlatform('ios');
    expect(() => getApiUrl('/api/spots')).toThrow(
      'EXPO_PUBLIC_API_URL must be an absolute URL on native platforms.'
    );
  });

  it('builds a URL from Expo hostUri when native and unconfigured', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    setPlatform('ios');
    const hostUri = Constants.expoConfig?.hostUri;
    if (!hostUri) {
      expect(() => getApiUrl('/api/spots')).toThrow('Missing API URL');
      return;
    }
    expect(getApiUrl('/api/spots')).toBe(`http://${hostUri}/api/spots`);
  });
});
