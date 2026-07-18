import { Platform } from 'react-native';
import { getApiUrl } from '../api';

const originalEnv = { ...process.env };
const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatform(os: 'ios' | 'web'): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  process.env = { ...originalEnv };
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
});
