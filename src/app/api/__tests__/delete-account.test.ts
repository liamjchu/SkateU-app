import { DELETE } from '../delete-account+api';

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

function deleteRequest(headers?: HeadersInit): Request {
  return new Request('https://app.test/api/delete-account', {
    method: 'DELETE',
    headers,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('DELETE /api/delete-account', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await DELETE(deleteRequest());
    expect(response.status).toBe(401);
  });

  it('returns 500 when deletion is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    const response = await DELETE(
      deleteRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(500);
  });

  it('requires a recent email OTP', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch;

    const response = await DELETE(
      deleteRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(403);
  });

  it('deletes the auth user after a recent OTP without a proof table', async () => {
    setConfigured();
    const payload = Buffer.from(
      JSON.stringify({
        amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }],
      })
    ).toString('base64');
    const otpToken = `hdr.${payload}.sig`;
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/auth/v1/admin/users/user-1') && init?.method === 'DELETE') {
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      deleteRequest({ Authorization: `Bearer ${otpToken}` })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('deletes the auth user after consuming a valid proof', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/account_deletion_proofs') && init?.method === 'DELETE') {
        return jsonResponse([{ user_id: 'user-1' }]);
      }
      if (url.includes('/auth/v1/admin/users/user-1') && init?.method === 'DELETE') {
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      deleteRequest({
        Authorization: 'Bearer good-token',
        'X-Delete-Account-Proof': 'proof-1',
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('rejects an expired or unmatched proof', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/account_deletion_proofs') && init?.method === 'DELETE') {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await DELETE(
      deleteRequest({
        Authorization: 'Bearer good-token',
        'X-Delete-Account-Proof': 'stale-proof',
      })
    );
    expect(response.status).toBe(403);
  });
});
