import { POST } from '../profile-bio+api';

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
  return new Request('https://app.test/api/profile-bio', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const PROFILE = {
  id: 'user-1',
  username: 'liam',
  avatar_url: null,
  bio: 'Skater at State. https://instagram.com/liam',
  updated_at: '2026-08-26T00:00:00.000Z',
};

const LEGAL = {
  id: 'user-1',
  legal_version: '2026-08-20',
  legal_accepted_at: '2026-08-21T00:00:00.000Z',
  age_attested_at: '2026-08-21T00:00:00.000Z',
};

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/profile-bio', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/profile-bio', { method: 'POST' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when the bio is too long', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ bio: 'a'.repeat(161) }));
    expect(response.status).toBe(400);
  });

  it('returns 500 when OpenAI is not configured for a non-empty bio', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ bio: 'Skater at State' }));
    expect(response.status).toBe(500);
  });

  it('saves an allowed bio onto the profile', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
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
                  approved: true,
                  flag: 'NONE',
                  reason: '',
                }),
              },
            },
          ],
        });
      }
      if (url.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
        return jsonResponse([PROFILE]);
      }
      if (url.includes('/rest/v1/profile_legal')) {
        return jsonResponse([LEGAL]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([PROFILE]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest({ bio: PROFILE.bio }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      allowed: boolean;
      profile: { bio: string | null };
    };
    expect(payload.allowed).toBe(true);
    expect(payload.profile.bio).toBe(PROFILE.bio);
  });

  it('clears a blank bio without calling OpenAI', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
        expect(JSON.parse(String(init.body))).toEqual({ bio: null });
        return jsonResponse([{ ...PROFILE, bio: null }]);
      }
      if (url.includes('/rest/v1/profile_legal')) {
        return jsonResponse([LEGAL]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ ...PROFILE, bio: null }]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest({ bio: '   ' }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      allowed: boolean;
      profile: { bio: string | null };
    };
    expect(payload.allowed).toBe(true);
    expect(payload.profile.bio).toBeNull();
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes('api.openai.com'))
    ).toBe(false);
  });

  it('returns a gentle reason when review rejects the bio', async () => {
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
                  approved: false,
                  flag: 'INAPPROPRIATE',
                  reason: 'Let’s keep this school-friendly.',
                }),
              },
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ bio: 'nsfw plug' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      reason: 'Let’s keep this one school-friendly and try again.',
    });
  });
});
