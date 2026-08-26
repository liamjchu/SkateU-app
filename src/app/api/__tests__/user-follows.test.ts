import { DELETE, GET, POST } from '../user-follows+api';

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
const followingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/user-follows', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/user-follows', {
        method: 'POST',
        body: JSON.stringify({ userId: followingId }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('rejects following yourself', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/user-follows', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ userId: viewerId }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('rejects a follow when a block exists', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([{ blocker_id: viewerId }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/user-follows', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ userId: followingId }),
      })
    );
    expect(response.status).toBe(403);
  });

  it('creates a follow and returns updated counts', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([]);
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/user_follows')) {
        return jsonResponse(null, 201);
      }
      if (url.includes('following_id=eq.') && url.includes('follower_id=eq.')) {
        return jsonResponse([{ follower_id: viewerId }]);
      }
      if (url.includes('following_id=eq.')) {
        return countResponse(1);
      }
      if (url.includes('follower_id=eq.')) {
        return countResponse(3);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/user-follows', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ userId: followingId }),
      })
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      followerCount: 1,
      followingCount: 3,
      isFollowing: true,
    });
  });

  it('treats a duplicate follow as success', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([]);
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/user_follows')) {
        return new Response('duplicate key value violates unique constraint 23505', {
          status: 409,
        });
      }
      if (url.includes('following_id=eq.') && url.includes('follower_id=eq.')) {
        return jsonResponse([{ follower_id: viewerId }]);
      }
      if (url.includes('following_id=eq.')) {
        return countResponse(1);
      }
      if (url.includes('follower_id=eq.')) {
        return countResponse(0);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/user-follows', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ userId: followingId }),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { isFollowing: boolean };
    expect(body.isFollowing).toBe(true);
  });
});

describe('DELETE /api/user-follows', () => {
  it('unfollows a user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (init?.method === 'DELETE' && url.includes('/rest/v1/user_follows')) {
        return jsonResponse(null, 200);
      }
      if (url.includes('following_id=eq.') && url.includes('follower_id=eq.')) {
        return jsonResponse([]);
      }
      if (url.includes('following_id=eq.')) {
        return countResponse(0);
      }
      if (url.includes('follower_id=eq.')) {
        return countResponse(2);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    }) as unknown as typeof fetch;

    const response = await DELETE(
      new Request(`https://app.test/api/user-follows?userId=${followingId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      followerCount: 0,
      followingCount: 2,
      isFollowing: false,
    });
  });

  it('returns 400 for an invalid user id', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await DELETE(
      new Request('https://app.test/api/user-follows?userId=', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(400);
  });
});

describe('GET /api/user-follows', () => {
  const followerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const blockedMemberId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const avatarUrl =
    'https://project.supabase.co/storage/v1/object/public/avatars/c.jpg';

  it('returns 400 for an invalid user id', async () => {
    setConfigured();
    const response = await GET(
      new Request('https://app.test/api/user-follows?userId=&list=followers')
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 for an invalid list', async () => {
    setConfigured();
    const response = await GET(
      new Request(
        `https://app.test/api/user-follows?userId=${followingId}&list=friends`
      )
    );
    expect(response.status).toBe(400);
  });

  it('returns 403 when the viewer is blocked with the profile owner', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([{ blocker_id: viewerId }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/user-follows?userId=${followingId}&list=followers`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(403);
  });

  it('returns joined users and isFollowing for followers', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks') && url.includes('limit=1')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/user_follows') && url.includes('created_at')) {
        return jsonResponse([
          { follower_id: followerId, created_at: '2026-08-01T00:00:00Z' },
        ]);
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          {
            id: followerId,
            username: 'campus_skater',
            avatar_url: avatarUrl,
          },
        ]);
      }
      if (url.includes('following_id=in.')) {
        return jsonResponse([{ following_id: followerId }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/user-follows?userId=${followingId}&list=followers`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: followerId,
          username: 'campus_skater',
          avatarUrl,
          isFollowing: true,
        },
      ],
    });
  });

  it('drops either-way blocked members from the list', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks') && url.includes('limit=1')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/user_follows') && url.includes('created_at')) {
        return jsonResponse([
          { follower_id: followerId, created_at: '2026-08-01T00:00:00Z' },
          { follower_id: blockedMemberId, created_at: '2026-07-01T00:00:00Z' },
        ]);
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([
          { blocker_id: viewerId, blocked_id: blockedMemberId },
        ]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          { id: followerId, username: 'campus_skater', avatar_url: null },
        ]);
      }
      if (url.includes('following_id=in.')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/user-follows?userId=${followingId}&list=followers`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: followerId,
          username: 'campus_skater',
          avatarUrl: null,
          isFollowing: false,
        },
      ],
    });
  });

  it('returns following users without auth and without isFollowing', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_follows') && url.includes('created_at')) {
        return jsonResponse([
          { following_id: followerId, created_at: '2026-08-01T00:00:00Z' },
        ]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          { id: followerId, username: null, avatar_url: null },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/user-follows?userId=${followingId}&list=following`
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          id: followerId,
          username: null,
          avatarUrl: null,
          isFollowing: false,
        },
      ],
    });
  });
});
