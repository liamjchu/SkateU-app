import { MINIMAL_JPEG } from '../../../lib/__tests__/imageFixtures';
import { DELETE, POST } from '../profile-avatar+api';

type FetchMock = jest.Mock<
  Promise<Response>,
  [string | URL | Request, RequestInit?]
>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

const PROFILE = {
  id: 'user-1',
  username: 'liam',
  avatar_url: null as string | null,
  updated_at: '2026-08-26T00:00:00.000Z',
};

const LEGAL = {
  id: 'user-1',
  legal_version: '2026-08-20',
  legal_accepted_at: '2026-08-21T00:00:00.000Z',
  age_attested_at: '2026-08-21T00:00:00.000Z',
};

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

function jpegFile(bytes: Uint8Array, name = 'avatar.jpg'): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name, { type: 'image/jpeg' });
}

function postRequest(file?: File, token = 'good-token'): Request {
  const form = new FormData();
  if (file) {
    form.append('image', file);
  }
  return new Request('https://app.test/api/profile-avatar', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/profile-avatar', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/profile-avatar', { method: 'POST' })
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

    const response = await POST(postRequest(jpegFile(MINIMAL_JPEG)));
    expect(response.status).toBe(500);
  });

  it('saves an approved photo and deletes the previous SkateU avatar', async () => {
    setConfigured();
    const previous =
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/old.jpg';
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/storage/v1/object/avatars/')) {
        return new Response('', { status: 200 });
      }
      if (url.includes('api.openai.com')) {
        return jsonResponse({
          choices: [{ message: { content: JSON.stringify({ approved: true, reason: '' }) } }],
        });
      }
      if (url.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
        return jsonResponse([], 200);
      }
      if (url.includes('/storage/v1/object/remove')) {
        return jsonResponse({}, 200);
      }
      if (url.includes('/rest/v1/profile_legal')) {
        return jsonResponse([LEGAL]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ ...PROFILE, avatar_url: previous }]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest(jpegFile(MINIMAL_JPEG)));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      allowed: boolean;
      profile: { avatar_url: string };
    };
    expect(payload.allowed).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/storage/v1/object/avatars/')
      )
    ).toBe(true);
    const removeCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/storage/v1/object/remove')
    );
    expect(removeCall?.[1]?.body).toContain('user-1/old.jpg');
  });

  it('returns a gentle reason and deletes the upload when the model rejects', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/storage/v1/object/avatars/')) {
        return new Response('', { status: 200 });
      }
      if (url.includes('api.openai.com')) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  approved: false,
                  reason: 'Let’s try a different photo.',
                }),
              },
            },
          ],
        });
      }
      if (url.includes('/storage/v1/object/remove')) {
        return jsonResponse({}, 200);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest(jpegFile(MINIMAL_JPEG)));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { allowed: boolean; reason: string };
    expect(payload.allowed).toBe(false);
    expect(payload.reason).toBe('Let’s try a different photo.');
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          String(call[0]).includes('/rest/v1/profiles') && call[1]?.method === 'PATCH'
      )
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/storage/v1/object/remove')
      )
    ).toBe(true);
  });

  it('fails closed when OpenAI is unavailable', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/storage/v1/object/avatars/')) {
        return new Response('', { status: 200 });
      }
      if (url.includes('api.openai.com')) {
        return jsonResponse({ error: 'busy' }, 500);
      }
      if (url.includes('/storage/v1/object/remove')) {
        return jsonResponse({}, 200);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest(jpegFile(MINIMAL_JPEG)));
    expect(response.status).toBe(503);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/storage/v1/object/remove')
      )
    ).toBe(true);
  });
});

describe('DELETE /api/profile-avatar', () => {
  it('clears avatar_url and deletes the stored object', async () => {
    setConfigured();
    const previous =
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/old.jpg';
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
        return jsonResponse([], 200);
      }
      if (url.includes('/storage/v1/object/remove')) {
        return jsonResponse({}, 200);
      }
      if (url.includes('/rest/v1/profile_legal')) {
        return jsonResponse([LEGAL]);
      }
      if (url.includes('/rest/v1/profiles')) {
        const afterPatch = fetchMock.mock.calls.some(
          (call) =>
            String(call[0]).includes('/rest/v1/profiles') &&
            call[1]?.method === 'PATCH'
        );
        return jsonResponse([
          { ...PROFILE, avatar_url: afterPatch ? null : previous },
        ]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      new Request('https://app.test/api/profile-avatar', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { profile: { avatar_url: string | null } };
    expect(payload.profile.avatar_url).toBeNull();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/storage/v1/object/remove')
      )
    ).toBe(true);
  });
});
