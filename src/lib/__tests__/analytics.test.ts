import { Platform } from 'react-native';

describe('analytics', () => {
  const originalKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const originalHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

  afterEach(() => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalKey;
    process.env.EXPO_PUBLIC_POSTHOG_HOST = originalHost;
    if (platformDescriptor) {
      Object.defineProperty(Platform, 'OS', platformDescriptor);
    }
    jest.resetModules();
  });

  it('reports missing PostHog configuration in development', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
      const { isAnalyticsEnabled } = require('../analytics') as {
        isAnalyticsEnabled: () => boolean;
      };

      expect(isAnalyticsEnabled).toThrow(
        'EXPO_PUBLIC_POSTHOG_API_KEY variable required by PostHog is missing or un-configured'
      );
    });
  });

  it('captures events when a key and host are configured', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'test-project-token';
      process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://analytics.example.test';
      const PostHog = require('posthog-react-native').default as jest.Mock;
      const {
        captureAnalyticsEvent,
        captureAuthCompleted,
        captureOauthAuthCompleted,
        identifyAnalyticsUser,
        isAnalyticsEnabled,
      } = require('../analytics') as {
        captureAnalyticsEvent: (
          event: string,
          properties?: Record<string, string>
        ) => void;
        captureAuthCompleted: (
          kind: 'login' | 'signup',
          method: 'email' | 'google' | 'apple'
        ) => void;
        captureOauthAuthCompleted: (
          createdAt: string | undefined,
          method: 'google' | 'apple'
        ) => void;
        identifyAnalyticsUser: (
          userId: string,
          personProperties?: { email?: string }
        ) => void;
        isAnalyticsEnabled: () => boolean;
      };

      expect(isAnalyticsEnabled()).toBe(true);
      captureAnalyticsEvent('spot_created', { spot_id: 'spot-1' });
      captureAuthCompleted('signup', 'email');
      captureOauthAuthCompleted(new Date().toISOString(), 'google');
      identifyAnalyticsUser('user-1', { email: 'skater@example.com' });

      expect(PostHog).toHaveBeenCalledWith(
        'test-project-token',
        expect.objectContaining({
          host: 'https://analytics.example.test',
          captureAppLifecycleEvents: true,
        })
      );
      const instance = PostHog.mock.results[0]?.value as {
        capture: jest.Mock;
        identify: jest.Mock;
      };
      expect(instance.capture).toHaveBeenCalledWith('spot_created', {
        spot_id: 'spot-1',
      });
      expect(instance.capture).toHaveBeenCalledWith('signup_completed', {
        method: 'email',
      });
      expect(instance.capture).toHaveBeenCalledWith('signup_completed', {
        method: 'google',
      });
      expect(instance.identify).toHaveBeenCalledWith('user-1', {
        email: 'skater@example.com',
      });
    });
  });

  it('classifies recently created users for OAuth signup vs login', () => {
    const { isRecentlyCreatedUser } = require('../analytics') as {
      isRecentlyCreatedUser: (
        createdAt: string | undefined,
        now?: number
      ) => boolean;
    };
    const now = Date.parse('2026-08-22T12:00:00.000Z');

    expect(
      isRecentlyCreatedUser(new Date(now - 10_000).toISOString(), now)
    ).toBe(true);
    expect(
      isRecentlyCreatedUser(new Date(now - 200_000).toISOString(), now)
    ).toBe(false);
    expect(isRecentlyCreatedUser(undefined, now)).toBe(false);
    expect(isRecentlyCreatedUser('not-a-date', now)).toBe(false);
  });

  it('reports a missing host in development', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'test-project-token';
      delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
      const { isAnalyticsEnabled } = require('../analytics') as {
        isAnalyticsEnabled: () => boolean;
      };

      expect(isAnalyticsEnabled).toThrow(
        'EXPO_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured'
      );
    });
  });

  it('stays disabled when configuration is missing outside development', () => {
    jest.isolateModules(() => {
      const globalDev = globalThis as { __DEV__?: boolean };
      const previousDev = globalDev.__DEV__;
      globalDev.__DEV__ = false;
      delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
      delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
      const { isAnalyticsEnabled, getAnalyticsClient } = require('../analytics') as {
        isAnalyticsEnabled: () => boolean;
        getAnalyticsClient: () => unknown;
      };

      expect(isAnalyticsEnabled()).toBe(false);
      expect(getAnalyticsClient()).toBeNull();
      globalDev.__DEV__ = previousDev;
    });
  });

  it('is disabled on web even when PostHog is configured', () => {
    jest.isolateModules(() => {
      const { Platform: IsolatedPlatform } = require('react-native') as typeof import('react-native');
      Object.defineProperty(IsolatedPlatform, 'OS', {
        configurable: true,
        value: 'web',
      });
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'test-project-token';
      process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://analytics.example.test';
      const { isAnalyticsEnabled, AnalyticsProvider } = require('../analytics') as {
        isAnalyticsEnabled: () => boolean;
        AnalyticsProvider: (props: { children: string }) => unknown;
      };

      expect(isAnalyticsEnabled()).toBe(false);
      expect(AnalyticsProvider({ children: 'child' })).toBe('child');
    });
  });

  it('screens, resets, and skips empty identify/screen calls', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'test-project-token';
      process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://analytics.example.test';
      const PostHog = require('posthog-react-native').default as jest.Mock;
      const {
        captureAnalyticsScreen,
        captureAuthCompleted,
        identifyAnalyticsUser,
        resetAnalyticsUser,
        AnalyticsProvider,
      } = require('../analytics') as {
        captureAnalyticsScreen: (name: string) => void;
        captureAuthCompleted: (
          kind: 'login' | 'signup',
          method: 'email' | 'google' | 'apple'
        ) => void;
        identifyAnalyticsUser: (userId: string) => void;
        resetAnalyticsUser: () => void;
        AnalyticsProvider: (props: { children: string }) => unknown;
      };

      captureAnalyticsScreen('');
      identifyAnalyticsUser('');
      captureAnalyticsScreen('Map');
      captureAuthCompleted('login', 'apple');
      resetAnalyticsUser();
      expect(AnalyticsProvider({ children: 'child' })).toEqual(
        expect.objectContaining({ props: expect.objectContaining({ children: 'child' }) })
      );

      const instance = PostHog.mock.results[0]?.value as {
        capture: jest.Mock;
        screen: jest.Mock;
        identify: jest.Mock;
        reset: jest.Mock;
      };
      expect(instance.screen).toHaveBeenCalledWith('Map');
      expect(instance.identify).not.toHaveBeenCalled();
      expect(instance.capture).toHaveBeenCalledWith('login_completed', {
        method: 'apple',
      });
      expect(instance.reset).toHaveBeenCalled();
    });
  });
});
