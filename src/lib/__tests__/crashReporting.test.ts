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
});
