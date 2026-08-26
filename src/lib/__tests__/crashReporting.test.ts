describe('crashReporting', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('sets and clears the Sentry user', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native') as {
        setUser: jest.Mock;
      };
      const { setCrashReportingUser, clearCrashReportingUser } = require('../crashReporting') as {
        setCrashReportingUser: (userId: string) => void;
        clearCrashReportingUser: () => void;
      };

      setCrashReportingUser('user-1');
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-1' });
      clearCrashReportingUser();
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  it('skips empty user ids', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native') as {
        setUser: jest.Mock;
      };
      const { setCrashReportingUser } = require('../crashReporting') as {
        setCrashReportingUser: (userId: string) => void;
      };

      setCrashReportingUser('');
      expect(Sentry.setUser).not.toHaveBeenCalled();
    });
  });

  it('does nothing when OTA updates are disabled', () => {
    jest.isolateModules(() => {
      const Sentry = require('@sentry/react-native') as {
        setTag: jest.Mock;
      };
      const { applyCrashReportingUpdateContext } = require('../crashReporting') as {
        applyCrashReportingUpdateContext: () => void;
      };

      applyCrashReportingUpdateContext();
      expect(Sentry.setTag).not.toHaveBeenCalled();
    });
  });

  it('tags Sentry with the current update when updates are enabled', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-updates', () => ({
        isEnabled: true,
        updateId: 'update-1',
        channel: 'production',
        runtimeVersion: '1.0.0',
      }));
      const Sentry = require('@sentry/react-native') as {
        setTag: jest.Mock;
      };
      const { applyCrashReportingUpdateContext } = require('../crashReporting') as {
        applyCrashReportingUpdateContext: () => void;
      };

      applyCrashReportingUpdateContext();
      expect(Sentry.setTag).toHaveBeenCalledWith('updateId', 'update-1');
      expect(Sentry.setTag).toHaveBeenCalledWith('channel', 'production');
      expect(Sentry.setTag).toHaveBeenCalledWith('runtimeVersion', '1.0.0');
    });
  });

  it('falls back to embedded and skips empty channel tags', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-updates', () => ({
        isEnabled: true,
        updateId: null,
        channel: null,
        runtimeVersion: '',
      }));
      const Sentry = require('@sentry/react-native') as {
        setTag: jest.Mock;
      };
      const { applyCrashReportingUpdateContext } = require('../crashReporting') as {
        applyCrashReportingUpdateContext: () => void;
      };

      applyCrashReportingUpdateContext();
      expect(Sentry.setTag).toHaveBeenCalledWith('updateId', 'embedded');
      expect(Sentry.setTag).not.toHaveBeenCalledWith(
        'channel',
        expect.anything()
      );
    });
  });

  it('swallows expo-updates failures in unsupported runtimes', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-updates', () => ({
        get isEnabled(): boolean {
          throw new Error('native module missing');
        },
      }));
      const { applyCrashReportingUpdateContext } = require('../crashReporting') as {
        applyCrashReportingUpdateContext: () => void;
      };

      expect(() => applyCrashReportingUpdateContext()).not.toThrow();
    });
  });
});
