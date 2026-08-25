jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component: unknown) => component,
  setUser: jest.fn(),
  setTag: jest.fn(),
}));

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
