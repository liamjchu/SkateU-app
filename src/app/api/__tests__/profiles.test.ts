import { GET } from '../profiles+api';

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
const profileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('GET /api/profiles', () => {
  it('returns 500 when the service-role key is missing', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await GET(
      new Request(`https://app.test/api/profiles?userId=${profileId}`)
    );
    expect(response.status).toBe(500);
  });

  it('returns 400 for an invalid user id', async () => {
    setConfigured();
    const response = await GET(
      new Request('https://app.test/api/profiles?userId=')
    );
    expect(response.status).toBe(400);
  });

  it('returns a public profile with counts when unauthenticated', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          { id: profileId, username: 'skater_jane', avatar_url: null },
        ]);
      }
      if (url.includes('following_id=eq.')) {
        return countResponse(4);
      }
      if (url.includes('follower_id=eq.')) {
        return countResponse(2);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(`https://app.test/api/profiles?userId=${profileId}`)
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profile: { id: profileId, username: 'skater_jane', avatarUrl: null, bio: null },
      followerCount: 4,
      followingCount: 2,
      isFollowing: false,
    });
  });

  it('loads a profile when the bio column has not been migrated yet', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/rest/v1/profiles') && url.includes('bio')) {
        return new Response(
          JSON.stringify({
            code: '42703',
            message: 'column profiles.bio does not exist',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          { id: profileId, username: 'skater_jane', avatar_url: null },
        ]);
      }
      if (url.includes('following_id=eq.')) {
        return countResponse(1);
      }
      if (url.includes('follower_id=eq.')) {
        return countResponse(0);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(`https://app.test/api/profiles?userId=${profileId}`)
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { id: profileId, username: 'skater_jane', bio: null },
    });
  });

  it('returns 404 when the profile is missing', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request(`https://app.test/api/profiles?userId=${profileId}`)
    );
    expect(response.status).toBe(404);
  });

  it('returns 403 when a block exists either way', async () => {
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
      new Request(`https://app.test/api/profiles?userId=${profileId}`, {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(403);
  });

  it('sets isFollowing when the viewer follows the profile', async () => {
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
        return jsonResponse([{ id: profileId, username: 'skater_jane' }]);
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
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      new Request(`https://app.test/api/profiles?userId=${profileId}`, {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { isFollowing: boolean };
    expect(body.isFollowing).toBe(true);
  });
});
