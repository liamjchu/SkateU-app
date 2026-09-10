import { POST } from '../set-password+api';

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

function postRequest(body: unknown, headers?: HeadersInit): Request {
  return new Request('https://app.test/api/set-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/set-password', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await POST(postRequest({ password: 'NewPass1!' }));
    expect(response.status).toBe(401);
  });

  it('returns 500 when the service-role key is missing', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await POST(
      postRequest({ password: 'NewPass1!' }, { Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(500);
  });

  it('rejects a password that fails the shared policy', async () => {
    setConfigured();
    const response = await POST(
      postRequest({ password: 'short' }, { Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Password needs at least 8 characters.',
    });
  });

  it('sets the password and adds email to the user’s providers', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/auth/v1/admin/users/user-1') && !init?.method) {
        return jsonResponse({
          app_metadata: { providers: ['google', 'apple'] },
          identities: [{ provider: 'apple' }, { provider: 'google' }],
        });
      }
      if (url.includes('/auth/v1/admin/users/user-1') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as {
          password: string;
          app_metadata: { providers: string[] };
        };
        expect(body.password).toBe('NewPass1!');
        expect(body.app_metadata.providers).toEqual(
          expect.arrayContaining(['google', 'apple', 'email'])
        );
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ password: 'NewPass1!' }, { Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
