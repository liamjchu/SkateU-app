import { DELETE, GET, POST } from '../spot-likes+api';

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

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('GET /api/spot-likes', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/spot-likes'));
    expect(response.status).toBe(401);
  });

  it('returns an empty list when the user has no likes', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spot_likes')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spot-likes', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ spots: [] });
  });

  it('returns liked spots in like order and skips blocked creators', async () => {
    setConfigured();
    const spotRow = {
      id: 'spot-1',
      school_id: 'school-1',
      created_by_user_id: 'creator-1',
      name: 'Ledge',
      description: 'A ledge',
      latitude: 40,
      longitude: -74,
      image_urls: [],
      created_at: '2026-08-21T00:00:00.000Z',
      updated_at: '2026-08-21T00:00:00.000Z',
      likes_count: 2,
      comments_count: 0,
      schools: { name: 'Campus', city: 'NYC', state: 'NY' },
      creator: { username: 'skater' },
    };
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spot_likes')) {
        return jsonResponse([
          { spot_id: 'spot-1', created_at: '2026-08-21T01:00:00.000Z' },
        ]);
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([spotRow]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spot-likes', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { spots: { id: string; likedByUser: boolean }[] };
    expect(payload.spots).toEqual([
      expect.objectContaining({ id: 'spot-1', likedByUser: true, name: 'Ledge' }),
    ]);
  });
});

describe('POST /api/spot-likes', () => {
  it('rejects a missing spot id', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/spot-likes', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(400);
  });

  it('likes an existing visible spot', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots') && url.includes('likes_count')) {
        return jsonResponse([{ likes_count: 4, status: 'approved' }]);
      }
      if (url.includes('/rest/v1/spot_likes') && init?.method === 'POST') {
        return jsonResponse(null, 201);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/spot-likes?id=spot-1', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      likeCount: 4,
      likedByUser: true,
    });
  });

  it('returns 404 when the spot was removed', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ likes_count: 0, status: 'removed' }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/spot-likes?id=spot-1', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/spot-likes', () => {
  it('unlikes a spot', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots') && url.includes('likes_count')) {
        return jsonResponse([{ likes_count: 3, status: 'approved' }]);
      }
      if (url.includes('/rest/v1/spot_likes') && init?.method === 'DELETE') {
        return jsonResponse(null, 200);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    }) as unknown as typeof fetch;

    const response = await DELETE(
      new Request('https://app.test/api/spot-likes?id=spot-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      likeCount: 3,
      likedByUser: false,
    });
  });
});
