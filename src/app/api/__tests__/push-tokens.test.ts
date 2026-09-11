import { DELETE, POST } from '../push-tokens+api';

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
const token = 'ExponentPushToken[abcDEF123]';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/push-tokens', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/push-tokens', {
        method: 'POST',
        body: JSON.stringify({ token, platform: 'ios' }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as FetchMock;

    const response = await POST(
      new Request('https://app.test/api/push-tokens', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ token: 'nope', platform: 'ios' }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('upserts a token for the signed-in user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/push_tokens') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          user_id: string;
          expo_push_token: string;
          platform: string;
        };
        expect(body).toMatchObject({
          user_id: viewerId,
          expo_push_token: token,
          platform: 'ios',
        });
        return jsonResponse(null, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await POST(
      new Request('https://app.test/api/push-tokens', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ token, platform: 'ios' }),
      })
    );
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/push-tokens', () => {
  it('deletes the token for the signed-in user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/push_tokens') && init?.method === 'DELETE') {
        expect(url).toContain(`user_id=eq.${viewerId}`);
        expect(decodeURIComponent(url)).toContain(`expo_push_token=eq.${token}`);
        return jsonResponse(null, 200);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await DELETE(
      new Request(
        `https://app.test/api/push-tokens?token=${encodeURIComponent(token)}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer good-token' },
        }
      )
    );
    expect(response.status).toBe(200);
  });
});
