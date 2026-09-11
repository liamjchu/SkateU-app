import {
  buildExpoPushMessage,
  isExpoPushToken,
  parseExpoPushTickets,
  tokensToDrop,
} from '../expoPush';

describe('isExpoPushToken', () => {
  it('accepts Expo tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abcDEF123_-]')).toBe(true);
    expect(isExpoPushToken('not-a-token')).toBe(false);
  });
});

describe('tokensToDrop', () => {
  it('returns DeviceNotRegistered tokens', () => {
    const messages = [
      buildExpoPushMessage({
        token: 'ExponentPushToken[good]',
        body: 'hello',
        data: { type: 'follow' },
      }),
      buildExpoPushMessage({
        token: 'ExponentPushToken[stale]',
        body: 'hello',
        data: { type: 'follow' },
      }),
    ];
    const tickets = parseExpoPushTickets({
      data: [
        { status: 'ok', id: 'ticket-1' },
        {
          status: 'error',
          message: 'gone',
          details: { error: 'DeviceNotRegistered' },
        },
      ],
    });
    expect(tokensToDrop(messages, tickets)).toEqual([
      'ExponentPushToken[stale]',
    ]);
  });
});
