import { useNotificationsStore } from '../notificationsStore';
import type { UserNotification } from '../../types/notification';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

function mockResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number }
): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone: () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  } as unknown as Response;
}

const fetchMock = jest.fn();

function makeNotification(
  overrides: Partial<UserNotification> = {}
): UserNotification {
  return {
    id: 'event-1',
    type: 'spot_like',
    body: 'alex liked your spot “Rail”',
    createdAt: '2026-09-10T00:00:00.000Z',
    readAt: null,
    actorId: 'user-2',
    actorUsername: 'alex',
    actorAvatarUrl: null,
    spotId: 'spot-1',
    spotName: 'Rail',
    spotImageUrl: null,
    ...overrides,
  };
}

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  useNotificationsStore.getState().clear();
});

describe('notificationsStore', () => {
  it('loads unread count without replacing the list', async () => {
    useNotificationsStore.setState({
      items: [makeNotification()],
      unreadCount: 0,
    });
    fetchMock.mockResolvedValue(mockResponse({ unreadCount: 3, notifications: [] }));
    await useNotificationsStore.getState().fetchUnreadCount('token');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/api/notifications?unreadCount=1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      })
    );
    expect(useNotificationsStore.getState().unreadCount).toBe(3);
    expect(useNotificationsStore.getState().items).toHaveLength(1);
  });

  it('loads the inbox and unread count', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        unreadCount: 1,
        notifications: [makeNotification()],
      })
    );
    await useNotificationsStore.getState().fetchNotifications('token');
    expect(useNotificationsStore.getState().items[0]?.body).toBe(
      'alex liked your spot “Rail”'
    );
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
    expect(useNotificationsStore.getState().loading).toBe(false);
  });

  it('clears the badge when marking all as read, without rewriting rows', async () => {
    const unread = makeNotification();
    useNotificationsStore.setState({ items: [unread], unreadCount: 1 });
    fetchMock.mockResolvedValue(mockResponse({ ok: true }));
    await useNotificationsStore.getState().markAllRead('token');
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
    expect(useNotificationsStore.getState().items[0]?.readAt).toBeNull();
  });

  it('hides a notification and restores it if the request fails', async () => {
    const unread = makeNotification();
    useNotificationsStore.setState({ items: [unread], unreadCount: 1 });
    fetchMock.mockResolvedValue(mockResponse({ error: 'nope' }, { ok: false }));
    await expect(
      useNotificationsStore.getState().hideNotification('event-1', 'token')
    ).rejects.toThrow('nope');
    expect(useNotificationsStore.getState().items).toEqual([unread]);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });

  it('hides an unread notification after a successful delete', async () => {
    useNotificationsStore.setState({
      items: [makeNotification()],
      unreadCount: 1,
    });
    fetchMock.mockResolvedValue(mockResponse({ ok: true }));
    await useNotificationsStore.getState().hideNotification('event-1', 'token');
    expect(useNotificationsStore.getState().items).toEqual([]);
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it('resets inbox state when the signed-in user changes', () => {
    useNotificationsStore.setState({
      userId: 'user-1',
      items: [makeNotification()],
      unreadCount: 2,
    });
    useNotificationsStore.getState().syncUser('user-1');
    expect(useNotificationsStore.getState().unreadCount).toBe(2);
    useNotificationsStore.getState().syncUser('user-2');
    expect(useNotificationsStore.getState()).toMatchObject({
      userId: 'user-2',
      items: [],
      unreadCount: 0,
    });
  });

  it('drops a blocked actor from the inbox', () => {
    useNotificationsStore.setState({
      items: [
        makeNotification(),
        makeNotification({
          id: 'event-2',
          actorId: 'user-3',
          readAt: '2026-09-10T00:00:00.000Z',
        }),
      ],
      unreadCount: 1,
    });
    useNotificationsStore.getState().hideActorNotifications('user-2');
    expect(useNotificationsStore.getState().items).toHaveLength(1);
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
  });

  it('swallows aborted unread fetches without logging', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValue(abort);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await useNotificationsStore.getState().fetchUnreadCount('token');
    expect(spy).not.toHaveBeenCalled();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
    spy.mockRestore();
  });

  it('shows an empty inbox when the first load times out', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValue(abort);
    await useNotificationsStore.getState().fetchNotifications('token');
    expect(useNotificationsStore.getState()).toMatchObject({
      items: [],
      unreadCount: 0,
      loading: false,
      error: null,
    });
  });
});
