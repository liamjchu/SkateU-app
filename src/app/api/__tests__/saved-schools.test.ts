import { DELETE, GET, POST, PUT } from '../saved-schools+api';

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
const schoolId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('GET /api/saved-schools', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/saved-schools'));
    expect(response.status).toBe(401);
  });

  it('returns saved school ids', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_saved_schools')) {
        return jsonResponse([{ school_id: schoolId }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/saved-schools', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ schoolIds: [schoolId] });
  });
});

describe('POST /api/saved-schools', () => {
  it('inserts a school for the signed-in user', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_saved_schools') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          user_id: viewerId,
          school_id: schoolId,
        });
        return jsonResponse(null, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await POST(
      new Request('https://app.test/api/saved-schools', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ schoolId }),
      })
    );
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/saved-schools', () => {
  it('removes a saved school', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_saved_schools') && init?.method === 'DELETE') {
        expect(url).toContain(`school_id=eq.${schoolId}`);
        return jsonResponse(null, 200);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await DELETE(
      new Request(`https://app.test/api/saved-schools?schoolId=${schoolId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
  });
});

describe('PUT /api/saved-schools', () => {
  it('adds missing ids and removes extras', async () => {
    setConfigured();
    const extraId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/user_saved_schools') && init?.method === 'DELETE') {
        expect(decodeURIComponent(url)).toContain(`school_id=in.(${extraId})`);
        return jsonResponse(null, 200);
      }
      if (url.includes('/rest/v1/user_saved_schools') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual([
          { user_id: viewerId, school_id: schoolId },
        ]);
        return jsonResponse(null, 201);
      }
      if (url.includes('/rest/v1/user_saved_schools')) {
        return jsonResponse([{ school_id: extraId }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await PUT(
      new Request('https://app.test/api/saved-schools', {
        method: 'PUT',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ schoolIds: [schoolId] }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ schoolIds: [schoolId] });
  });
});
