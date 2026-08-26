jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component: unknown) => component,
  setUser: jest.fn(),
  setTag: jest.fn(),
}));

if (!process.env.EXPO_PUBLIC_POSTHOG_API_KEY) {
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'test-posthog-key';
}
if (!process.env.EXPO_PUBLIC_POSTHOG_HOST) {
  process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://example.com';
}

jest.mock('expo-image', () => {
  const React = require('react');
  const { Image } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) =>
      React.createElement(Image, props),
  };
});

jest.mock('expo-updates', () => ({
  isEnabled: false,
  updateId: null,
  channel: null,
  runtimeVersion: null,
}));

jest.mock('posthog-react-native', () => {
  const PostHog = jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    screen: jest.fn(),
  }));

  return {
    __esModule: true,
    default: PostHog,
    PostHog,
    PostHogProvider: ({ children }: { children: unknown }) => children,
  };
});
