import fs from 'fs';
import path from 'path';
import { LEGAL_VERSION } from '../../../content/legal';
import { GET, POST } from '../accept-legal+api';
import { PROFILE_LEGAL_TABLE_COLUMNS } from '../../../lib/legalAcceptance';

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
  return new Request('https://app.test/api/accept-legal', {
    method: 'POST',
    headers,
  });
}

function getRequest(headers?: HeadersInit): Request {
  return new Request('https://app.test/api/accept-legal', {
    method: 'GET',
    headers,
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/accept-legal', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(postRequest());
    expect(response.status).toBe(401);
  });

  it('returns 500 when the service-role key is missing', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(500);
  });

  it('records the current legal version and age attestation privately', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }

      if (url.includes('/rest/v1/profile_legal') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          id: string;
          legal_version: string;
          legal_accepted_at: string;
          age_attested_at: string;
        };
        expect(body.id).toBe('user-1');
        expect(body.legal_version).toBe(LEGAL_VERSION);
        expect(body.legal_accepted_at).toBe(body.age_attested_at);
        return jsonResponse(null, 201);
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

      if (url.includes('/rest/v1/profile_legal?')) {
        expect(decodeURIComponent(url)).toContain(PROFILE_LEGAL_TABLE_COLUMNS);
        return jsonResponse([
          {
            id: 'user-1',
            legal_version: LEGAL_VERSION,
            legal_accepted_at: '2026-08-20T00:00:00.000Z',
            age_attested_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      profile: { id: string; legal_version: string; username: string };
    };
    expect(payload.profile.id).toBe('user-1');
    expect(payload.profile.legal_version).toBe(LEGAL_VERSION);
    expect(payload.profile.username).toBe('liam');
  });

  it('writes legal columns on profiles when profile_legal is missing', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }

      if (url.includes('/rest/v1/profile_legal') && init?.method === 'POST') {
        return jsonResponse(
          {
            code: 'PGRST205',
            message: "Could not find the table 'public.profile_legal' in the schema cache",
          },
          404
        );
      }

      if (url.includes('/rest/v1/profiles?') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as {
          legal_version: string;
          legal_accepted_at: string;
          age_attested_at: string;
        };
        expect(body.legal_version).toBe(LEGAL_VERSION);
        expect(body.legal_accepted_at).toBe(body.age_attested_at);
        return new Response(null, { status: 204 });
      }

      if (url.includes('/rest/v1/profile_legal?')) {
        return jsonResponse(
          {
            code: 'PGRST205',
            message: "Could not find the table 'public.profile_legal' in the schema cache",
          },
          404
        );
      }

      if (url.includes('/rest/v1/profiles?')) {
        if (decodeURIComponent(url).includes('legal_version')) {
          return jsonResponse([
            {
              id: 'user-1',
              legal_version: LEGAL_VERSION,
              legal_accepted_at: '2026-08-20T00:00:00.000Z',
              age_attested_at: '2026-08-20T00:00:00.000Z',
            },
          ]);
        }
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
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      profile: { id: string; legal_version: string; username: string };
    };
    expect(payload.profile.id).toBe('user-1');
    expect(payload.profile.legal_version).toBe(LEGAL_VERSION);
  });
});

describe('GET /api/accept-legal', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
  });

  it('returns 500 when the service-role key is missing', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await GET(
      getRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(500);
  });

  it('returns 401 when the access token is rejected', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'invalid' }, 401)
    ) as unknown as typeof fetch;
    const response = await GET(
      getRequest({ Authorization: 'Bearer bad-token' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 502 when the merged profile is missing', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    const response = await GET(
      getRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(502);
  });

  it('maps a timed-out profile fetch', async () => {
    setConfigured();
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw abort;
    }) as unknown as typeof fetch;
    const response = await GET(
      getRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(504);
  });
  it('returns the caller’s public profile merged with private legal fields', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
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
      if (url.includes('/rest/v1/profile_legal?')) {
        return jsonResponse([
          {
            id: 'user-1',
            legal_version: LEGAL_VERSION,
            legal_accepted_at: '2026-08-20T00:00:00.000Z',
            age_attested_at: '2026-08-20T00:00:00.000Z',
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await GET(
      getRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      profile: { legal_version: string; username: string };
    };
    expect(payload.profile.username).toBe('liam');
    expect(payload.profile.legal_version).toBe(LEGAL_VERSION);
  });

  it('reads legal columns from profiles when profile_legal is missing', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profile_legal?')) {
        return jsonResponse(
          {
            code: 'PGRST205',
            message: "Could not find the table 'public.profile_legal' in the schema cache",
            hint: "Perhaps you meant the table 'public.profiles'",
          },
          404
        );
      }
      if (url.includes('/rest/v1/profiles?')) {
        if (decodeURIComponent(url).includes('legal_version')) {
          return jsonResponse([
            {
              id: 'user-1',
              legal_version: LEGAL_VERSION,
              legal_accepted_at: '2026-08-20T00:00:00.000Z',
              age_attested_at: '2026-08-20T00:00:00.000Z',
            },
          ]);
        }
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
    }) as unknown as typeof fetch;

    const response = await GET(
      getRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      profile: { legal_version: string; username: string };
    };
    expect(payload.profile.username).toBe('liam');
    expect(payload.profile.legal_version).toBe(LEGAL_VERSION);
  });

  it('returns 401 when the access token is rejected', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'invalid' }, 401)
    ) as unknown as typeof fetch;
    const response = await POST(
      postRequest({ Authorization: 'Bearer bad-token' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 502 when the saved profile cannot be loaded', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/profile_legal') && init?.method === 'POST') {
        return jsonResponse(null, 201);
      }
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(502);
  });

  it('maps a timed-out save', async () => {
    setConfigured();
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    global.fetch = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      throw abort;
    }) as unknown as typeof fetch;
    const response = await POST(
      postRequest({ Authorization: 'Bearer good-token' })
    );
    expect(response.status).toBe(504);
  });
});

describe('profile legal acceptance SQL', () => {
  it('blocks authenticated clients from writing legal columns on profiles', () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../supabase/profile_legal_acceptance_setup.sql'
      ),
      'utf8'
    );
    expect(sql).toContain('protect_profile_legal_columns');
    expect(sql).toContain(
      'Profile legal acceptance columns cannot be changed by clients'
    );
  });

  it('moves legal timestamps onto a private table', () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../supabase/profile_legal_private_setup.sql'
      ),
      'utf8'
    );
    expect(sql).toContain('create table if not exists public.profile_legal');
    expect(sql).toContain('protect_profile_legal_row');
    expect(sql).toContain(
      'Profile legal acceptance rows cannot be changed by clients'
    );
    expect(sql).toContain('drop column if exists legal_version');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain(
      'revoke all on table public.profile_legal from public, anon, authenticated'
    );
    expect(sql).toContain(
      'grant all on table public.profile_legal to postgres, service_role'
    );
    expect(sql).toContain("notify pgrst, 'reload schema'");
    expect(sql).not.toMatch(
      /create policy[\s\S]*on public\.profile_legal/i
    );
  });
});
