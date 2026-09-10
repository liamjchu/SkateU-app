import { DELETE, GET, PATCH, mapNotification } from '../notifications+api';

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function setConfigured(): void {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function countResponse(count: number): Response {
  return new Response(JSON.stringify([]), {
    status: 206,
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': `0-0/${count}`,
    },
  });
}

const viewerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const notificationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('mapNotification', () => {
  it('maps a like with actor and spot details', () => {
    expect(
      mapNotification({
        id: 'event-1',
        type: 'spot_like',
        actor_id: 'user-2',
        spot_id: 'spot-1',
        comment_id: null,
        read_at: null,
        created_at: '2026-09-10T00:00:00.000Z',
        actor: {
          username: 'alex',
          avatar_url: 'https://project.supabase.co/storage/v1/object/public/avatars/a.jpg',
          xp_total: 120,
        },
        spot: { name: 'Library Ledge', image_urls: ['https://img.test/ledge.jpg'] },
      })
    ).toEqual({
      id: 'event-1',
      type: 'spot_like',
      body: 'alex liked your spot “Library Ledge”',
      createdAt: '2026-09-10T00:00:00.000Z',
      readAt: null,
      actorId: 'user-2',
      actorUsername: 'alex',
      actorAvatarUrl:
        'https://project.supabase.co/storage/v1/object/public/avatars/a.jpg',
      actorRank: 'shop_rider',
      spotId: 'spot-1',
      spotName: 'Library Ledge',
      spotImageUrl: 'https://img.test/ledge.jpg',
    });
  });

  it('ignores unknown types', () => {
    expect(
      mapNotification({
        id: 'event-1',
        type: 'spot_approved',
        actor_id: null,
        spot_id: null,
        read_at: null,
        created_at: '2026-09-10T00:00:00.000Z',
        actor: null,
        spot: null,
      })
    ).toBeNull();
  });
});

describe('GET /api/notifications', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/notifications'));
    expect(response.status).toBe(401);
  });

  it('returns the signed-in user’s visible notifications and unread count', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        expect(decodeURIComponent(url)).toContain('id=in.(user-2)');
        return jsonResponse([
          { id: 'user-2', username: 'mina', avatar_url: null, xp_total: 0 },
        ]);
      }
      if (url.includes('/rest/v1/user_notifications')) {
        expect(url).toContain(`recipient_id=eq.${viewerId}`);
        expect(url).toContain('hidden_at=is.null');
        expect(url).not.toContain('read_at=is.null');
        return jsonResponse([
          {
            id: 'event-1',
            type: 'follow',
            actor_id: 'user-2',
            spot_id: null,
            comment_id: null,
            read_at: null,
            created_at: '2026-09-10T00:00:00.000Z',
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/notifications', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unreadCount: 1,
      notifications: [
        {
          id: 'event-1',
          type: 'follow',
          body: 'mina started following you',
          createdAt: '2026-09-10T00:00:00.000Z',
          readAt: null,
          actorId: 'user-2',
          actorUsername: 'mina',
          actorAvatarUrl: null,
          actorRank: 'hobbyist',
          spotId: null,
          spotName: null,
          spotImageUrl: null,
        },
      ],
    });
  });

  it('can return only the unread count', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        expect(url).toContain('read_at=is.null');
        return countResponse(4);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/notifications?unreadCount=1', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unreadCount: 4,
      notifications: [],
    });
  });

  it('treats a missing notifications table as an empty inbox', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        return jsonResponse(
          {
            code: 'PGRST205',
            message: "Could not find the table 'public.user_notifications' in the schema cache",
          },
          404
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/notifications', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unreadCount: 0,
      notifications: [],
    });
  });

  it('treats an empty inbox as a single list lookup', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/notifications', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unreadCount: 0,
      notifications: [],
    });
  });

  it('treats an empty count range as zero unread', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        return new Response(JSON.stringify([]), {
          status: 416,
          headers: {
            'Content-Type': 'application/json',
            'Content-Range': '*/0',
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/notifications?unreadCount=1', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unreadCount: 0,
      notifications: [],
    });
  });
});

describe('PATCH /api/notifications', () => {
  it('marks all unread notifications as read for the signed-in user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        expect(init?.method).toBe('PATCH');
        expect(url).toContain(`recipient_id=eq.${viewerId}`);
        expect(url).toContain('hidden_at=is.null');
        expect(url).toContain('read_at=is.null');
        expect(url).not.toMatch(/[?&]id=eq\./);
        const body = JSON.parse(String(init?.body)) as { read_at?: string };
        expect(typeof body.read_at).toBe('string');
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await PATCH(
      new Request('https://app.test/api/notifications', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('marks a single notification as read', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        expect(init?.method).toBe('PATCH');
        expect(url).toContain(`id=eq.${notificationId}`);
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await PATCH(
      new Request('https://app.test/api/notifications', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ id: notificationId }),
      })
    );
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/notifications', () => {
  it('hides a notification for the signed-in user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_notifications')) {
        expect(init?.method).toBe('PATCH');
        expect(url).toContain(`id=eq.${notificationId}`);
        expect(url).toContain(`recipient_id=eq.${viewerId}`);
        expect(url).toContain('hidden_at=is.null');
        const body = JSON.parse(String(init?.body)) as { hidden_at?: string };
        expect(typeof body.hidden_at).toBe('string');
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await DELETE(
      new Request(`https://app.test/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('rejects a missing id', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as FetchMock;

    const response = await DELETE(
      new Request('https://app.test/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(400);
  });
});
