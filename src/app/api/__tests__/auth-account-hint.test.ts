import { POST, hintFromAdminUser } from '../auth-account-hint+api';

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

describe('hintFromAdminUser', () => {
  it('returns unknown when the address is not found', () => {
    expect(hintFromAdminUser(null)).toBe('unknown');
  });

  it('returns google for a Google-only account', () => {
    expect(
      hintFromAdminUser({
        email: 'skater@example.com',
        app_metadata: { providers: ['google'] },
      })
    ).toBe('google');
  });
});

describe('POST /api/auth-account-hint', () => {
  it('returns a google hint for a matching admin user', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/admin/users')) {
        return jsonResponse({
          users: [
            {
              email: 'skater@example.com',
              app_metadata: { providers: ['google'] },
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/auth-account-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'skater@example.com' }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hint: 'google' });
  });

  it('does not claim an account exists when the lookup finds nobody', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ users: [] })
    ) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/auth-account-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com' }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hint: 'unknown' });
  });
});
