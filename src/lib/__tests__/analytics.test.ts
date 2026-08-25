describe('analytics', () => {
  const originalKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const originalHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;

  afterEach(() => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalKey;
    process.env.EXPO_PUBLIC_POSTHOG_HOST = originalHost;
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
  });
});
