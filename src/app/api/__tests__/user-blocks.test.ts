import { DELETE, GET, POST } from '../user-blocks+api';

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

const viewerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const blockedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('GET /api/user-blocks', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/user-blocks'));
    expect(response.status).toBe(401);
  });

  it('returns blocked users with usernames', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([
          { blocked_id: blockedId, created_at: '2026-08-21T00:00:00.000Z' },
        ]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ id: blockedId, username: 'blocked_skater' }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/user-blocks', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [{ userId: blockedId, username: 'blocked_skater' }],
    });
  });
});

describe('POST /api/user-blocks', () => {
  it('rejects blocking yourself', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/user-blocks', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ userId: viewerId }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('creates a block', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/user_blocks')) {
        return jsonResponse(null, 201);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ id: blockedId, username: 'blocked_skater' }]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/user-blocks', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ userId: blockedId }),
      })
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      user: { userId: blockedId, username: 'blocked_skater' },
    });
  });
});

describe('DELETE /api/user-blocks', () => {
  it('unblocks a user', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (init?.method === 'DELETE' && url.includes('/rest/v1/user_blocks')) {
        return jsonResponse(null, 200);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      new Request(
        `https://app.test/api/user-blocks?userId=${blockedId}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer good-token' },
        }
      )
    );
    expect(response.status).toBe(200);
  });
});
