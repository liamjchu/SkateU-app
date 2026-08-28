import { POST } from '../abandon-underage-account+api';

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

function postRequest(headers?: HeadersInit): Request {
  return new Request('https://app.test/api/abandon-underage-account', {
    method: 'POST',
    headers,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/abandon-underage-account', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(postRequest());
    expect(response.status).toBe(401);
  });

  it('refuses to delete an account that already has a username', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return jsonResponse([
          {
            id: 'user-1',
            username: 'liam',
            avatar_url: null,
            updated_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(403);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/auth/v1/admin/users/')
      )
    ).toBe(false);
  });

  it('returns 500 when abandonment is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Account removal is not configured.',
    });
  });

  it('returns 401 when the token is invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ error: 'invalid' }, 401);
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer bad-token' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 503 when auth lookup times out', async () => {
    setConfigured();
    global.fetch = jest.fn(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(503);
  });

  it('returns 502 when the profile row is missing', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(502);
  });

  it('returns 502 when auth delete fails', async () => {
    setConfigured();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return jsonResponse([
          {
            id: 'user-1',
            username: null,
            avatar_url: null,
            updated_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }
      if (url.includes('/auth/v1/admin/users/user-1')) {
        return jsonResponse({ error: 'nope' }, 500);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(502);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 504 when delete is aborted', async () => {
    setConfigured();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return jsonResponse([
          {
            id: 'user-1',
            username: null,
            avatar_url: null,
            updated_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: 'That took too long. Try again in a sec.',
    });
  });

  it('returns 502 when delete throws a generic error', async () => {
    setConfigured();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return jsonResponse([
          {
            id: 'user-1',
            username: null,
            avatar_url: null,
            updated_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }
      throw new Error('upstream');
    }) as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(502);
  });

  it('deletes an incomplete account', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles?')) {
        return jsonResponse([
          {
            id: 'user-1',
            username: null,
            avatar_url: null,
            updated_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }
      if (url.includes('/auth/v1/admin/users/user-1')) {
        expect(init?.method).toBe('DELETE');
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
