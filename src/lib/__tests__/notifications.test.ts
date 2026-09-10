import {
  formatNotificationBody,
  formatNotificationsA11yLabel,
  formatUnreadBadge,
  mapNotificationView,
  notificationRoute,
  parseNotificationType,
} from '../notifications';

describe('parseNotificationType', () => {
  it('accepts known types and rejects unknown values', () => {
    expect(parseNotificationType('spot_like')).toBe('spot_like');
    expect(parseNotificationType('follow')).toBe('follow');
    expect(parseNotificationType('like_received')).toBeNull();
    expect(parseNotificationType(null)).toBeNull();
  });
});

describe('formatNotificationBody', () => {
  it('names the actor and spot for likes and comments', () => {
    expect(
      formatNotificationBody({
        type: 'spot_like',
        actorUsername: 'alex',
        spotName: 'Library Ledge',
      })
    ).toBe('alex liked your spot “Library Ledge”');
    expect(
      formatNotificationBody({
        type: 'spot_comment',
        actorUsername: 'sam',
        spotName: 'Stairs',
      })
    ).toBe('sam commented on “Stairs”');
  });

  it('falls back when the actor or spot name is missing', () => {
    expect(
      formatNotificationBody({
        type: 'spot_like',
        actorUsername: null,
        spotName: null,
      })
    ).toBe('Someone liked your spot');
    expect(
      formatNotificationBody({
        type: 'spot_comment',
        actorUsername: '  ',
        spotName: null,
      })
    ).toBe('Someone commented on your spot');
    expect(
      formatNotificationBody({
        type: 'comment_reply',
        actorUsername: 'jay',
        spotName: 'Rail',
      })
    ).toBe('jay replied to your comment');
    expect(
      formatNotificationBody({
        type: 'follow',
        actorUsername: 'mina',
        spotName: null,
      })
    ).toBe('mina started following you');
  });
});

describe('formatUnreadBadge', () => {
  it('hides zero and caps at 9+', () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(1)).toBe('1');
    expect(formatUnreadBadge(9)).toBe('9');
    expect(formatUnreadBadge(12)).toBe('9+');
  });
});

describe('formatNotificationsA11yLabel', () => {
  it('describes unread counts', () => {
    expect(formatNotificationsA11yLabel(0)).toBe('Notifications');
    expect(formatNotificationsA11yLabel(1)).toBe('Notifications, 1 unread');
    expect(formatNotificationsA11yLabel(4)).toBe('Notifications, 4 unread');
    expect(formatNotificationsA11yLabel(12)).toBe(
      'Notifications, more than 9 unread'
    );
  });
});

describe('notificationRoute', () => {
  it('opens comments for spot activity and profiles for follows', () => {
    expect(
      notificationRoute({
        type: 'spot_like',
        actorId: 'user-2',
        spotId: 'spot-1',
        spotName: 'Rail',
      })
    ).toEqual({ kind: 'comments', spotId: 'spot-1', spotName: 'Rail' });
    expect(
      notificationRoute({
        type: 'follow',
        actorId: 'user-2',
        spotId: null,
        spotName: null,
      })
    ).toEqual({ kind: 'profile', userId: 'user-2' });
    expect(
      notificationRoute({
        type: 'follow',
        actorId: null,
        spotId: null,
        spotName: null,
      })
    ).toEqual({ kind: 'none' });
    expect(
      notificationRoute({
        type: 'comment_reply',
        actorId: 'user-2',
        spotId: null,
        spotName: 'Rail',
      })
    ).toEqual({ kind: 'none' });
  });
});

describe('mapNotificationView', () => {
  it('parses a client payload and drops incomplete rows', () => {
    expect(
      mapNotificationView({
        id: 'event-1',
        type: 'spot_like',
        body: 'alex liked your spot',
        createdAt: '2026-09-10T00:00:00.000Z',
        readAt: null,
        actorId: 'user-2',
        actorUsername: 'alex',
        actorAvatarUrl: null,
        actorRank: 'hobbyist',
        spotId: 'spot-1',
        spotName: 'Rail',
        spotImageUrl: null,
      })
    ).toMatchObject({
      id: 'event-1',
      type: 'spot_like',
      actorRank: 'hobbyist',
      spotName: 'Rail',
    });
    expect(mapNotificationView({ id: 'event-1', type: 'nope' })).toBeNull();
  });
});
