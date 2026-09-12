import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
  preferenceAllowsPush,
} from '../notificationPreferences';

describe('parseNotificationPreferences', () => {
  it('falls back to defaults', () => {
    expect(parseNotificationPreferences(null)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it('reads boolean fields', () => {
    expect(
      parseNotificationPreferences({
        pushEnabled: false,
        notifySocial: false,
        notifyCampus: true,
        notifySpotUpdates: false,
      })
    ).toEqual({
      pushEnabled: false,
      notifySocial: false,
      notifyCampus: true,
      notifySpotUpdates: false,
    });
  });
});

describe('preferenceAllowsPush', () => {
  it('blocks everything when the master switch is off', () => {
    expect(
      preferenceAllowsPush('follow', {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        pushEnabled: false,
      })
    ).toBe(false);
  });

  it('honors category switches', () => {
    expect(
      preferenceAllowsPush('spot_like', DEFAULT_NOTIFICATION_PREFERENCES)
    ).toBe(true);
    expect(
      preferenceAllowsPush('saved_school_spot', {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        notifyCampus: false,
      })
    ).toBe(false);
    expect(
      preferenceAllowsPush('spot_removed', {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        notifySpotUpdates: false,
      })
    ).toBe(false);
  });
});
