import { GET, PATCH } from '../notification-preferences+api';

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

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('GET /api/notification-preferences', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await GET(
      new Request('https://app.test/api/notification-preferences')
    );
    expect(response.status).toBe(401);
  });

  it('returns the signed-in user’s preferences', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          {
            push_enabled: true,
            notify_social: false,
            notify_campus: true,
            notify_spot_updates: true,
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/notification-preferences', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      preferences: {
        pushEnabled: true,
        notifySocial: false,
        notifyCampus: true,
        notifySpotUpdates: true,
      },
    });
  });
});

describe('PATCH /api/notification-preferences', () => {
  it('merges a single field onto the saved preferences', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/profiles') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as {
          push_enabled: boolean;
          notify_social: boolean;
        };
        expect(body.push_enabled).toBe(false);
        expect(body.notify_social).toBe(true);
        return jsonResponse([
          {
            push_enabled: false,
            notify_social: true,
            notify_campus: true,
            notify_spot_updates: true,
          },
        ]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([
          {
            push_enabled: true,
            notify_social: true,
            notify_campus: true,
            notify_spot_updates: true,
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await PATCH(
      new Request('https://app.test/api/notification-preferences', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ pushEnabled: false }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      preferences: {
        pushEnabled: false,
        notifySocial: true,
        notifyCampus: true,
        notifySpotUpdates: true,
      },
    });
  });
});
