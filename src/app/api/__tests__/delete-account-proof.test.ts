import { POST } from '../delete-account-proof+api';

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

function otpAccessToken(timestamp = Math.floor(Date.now() / 1000)): string {
  const payload = Buffer.from(
    JSON.stringify({ amr: [{ method: 'otp', timestamp }] })
  ).toString('base64');
  return `hdr.${payload}.sig`;
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/delete-account-proof', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/delete-account-proof', { method: 'POST' })
    );
    expect(response.status).toBe(401);
  });

  it('rejects a token that was not recently verified with OTP', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/delete-account-proof', {
        method: 'POST',
        headers: { Authorization: 'Bearer not-a-jwt' },
      })
    );
    expect(response.status).toBe(403);
  });

  it('issues a short-lived proof after a recent OTP', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/account_deletion_proofs') && init?.method === 'POST') {
        return jsonResponse(null, 201);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/delete-account-proof', {
        method: 'POST',
        headers: { Authorization: `Bearer ${otpAccessToken()}` },
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { proof?: string; expiresAt?: string };
    expect(typeof payload.proof).toBe('string');
    expect(payload.proof?.length).toBeGreaterThan(8);
    expect(typeof payload.expiresAt).toBe('string');
  });
});
