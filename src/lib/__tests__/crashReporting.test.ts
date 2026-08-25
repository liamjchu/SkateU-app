describe('crashReporting', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    jest.resetModules();
  });

  it('leaves Sentry unused when no DSN is configured', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
      const Sentry = require('@sentry/react-native') as {
        init: jest.Mock;
        setUser: jest.Mock;
      };
      const {
        initCrashReporting,
        wrapRoot,
        setCrashReportingUser,
        clearCrashReportingUser,
      } = require('../crashReporting') as {
        initCrashReporting: () => void;
        wrapRoot: (root: unknown) => unknown;
        setCrashReportingUser: (userId: string) => void;
        clearCrashReportingUser: () => void;
      };
      const Root = () => null;

      initCrashReporting();
      setCrashReportingUser('user-1');
      clearCrashReportingUser();
      expect(Sentry.init).not.toHaveBeenCalled();
      expect(Sentry.setUser).not.toHaveBeenCalled();
      expect(wrapRoot(Root)).toBe(Root);
    });
  });

  it('initializes Sentry when a DSN is set', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_SENTRY_DSN =
        'https://examplePublicKey@o0.ingest.sentry.io/0';
      const Sentry = require('@sentry/react-native') as {
        init: jest.Mock;
        setUser: jest.Mock;
      };
      const {
        initCrashReporting,
        wrapRoot,
        setCrashReportingUser,
        clearCrashReportingUser,
      } = require('../crashReporting') as {
        initCrashReporting: () => void;
        wrapRoot: (root: unknown) => unknown;
        setCrashReportingUser: (userId: string) => void;
        clearCrashReportingUser: () => void;
      };
      const Root = () => null;

      initCrashReporting();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
          sendDefaultPii: false,
          enableAutoSessionTracking: true,
          tracesSampleRate: 0,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
        })
      );
      setCrashReportingUser('user-1');
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-1' });
      clearCrashReportingUser();
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
      expect(wrapRoot(Root)).toBe(Root);
    });
  });
});
