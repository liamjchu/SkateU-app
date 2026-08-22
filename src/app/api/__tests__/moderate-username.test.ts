import { POST } from '../moderate-username+api';

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function setConfigured(): void {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function postRequest(body: unknown, token = 'good-token'): Request {
  return new Request('https://app.test/api/moderate-username', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/moderate-username', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/moderate-username', { method: 'POST' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 500 when OpenAI is not configured', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ username: 'liam' }));
    expect(response.status).toBe(500);
  });

  it('rejects an invalid username before calling OpenAI', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ username: 'AB' }));
    expect(response.status).toBe(400);
  });

  it('saves an allowed username onto the profile', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('api.openai.com')) {
        return jsonResponse({
          choices: [{ message: { content: JSON.stringify({ appropriate: true, reason: '' }) } }],
        });
      }
      if (url.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
        return jsonResponse([
          {
            id: 'user-1',
            username: 'liam',
            avatar_url: null,
            updated_at: '2026-08-21T00:00:00.000Z',
          },
        ]);
      }
      if (url.includes('/rest/v1/profile_legal')) {
        return jsonResponse([
          {
            id: 'user-1',
            legal_version: '2026-08-20',
            legal_accepted_at: '2026-08-21T00:00:00.000Z',
            age_attested_at: '2026-08-21T00:00:00.000Z',
          },
        ]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          {
            id: 'user-1',
            username: 'liam',
            avatar_url: null,
            updated_at: '2026-08-21T00:00:00.000Z',
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest({ username: 'liam' }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      allowed: boolean;
      profile: { username: string };
    };
    expect(payload.allowed).toBe(true);
    expect(payload.profile.username).toBe('liam');
  });

  it('returns a gentle reason when the model rejects the username', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('api.openai.com')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  appropriate: false,
                  reason: 'Let’s try a different username.',
                }),
              },
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ username: 'admin' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      reason: 'Let’s try a different username.',
    });
  });
});
