import { POST } from '../push/dispatch+api';

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function setConfigured(): void {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret-key';
  process.env.PUSH_DISPATCH_SECRET = 'dispatch-secret';
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const notificationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const recipientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token = 'ExponentPushToken[abcDEF123]';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('POST /api/push/dispatch', () => {
  it('rejects a missing or invalid secret', async () => {
    setConfigured();
    const missing = await POST(
      new Request('https://app.test/api/push/dispatch', {
        method: 'POST',
        body: JSON.stringify({ id: notificationId }),
      })
    );
    expect(missing.status).toBe(401);

    const wrong = await POST(
      new Request('https://app.test/api/push/dispatch', {
        method: 'POST',
        headers: { 'x-push-dispatch-secret': 'nope' },
        body: JSON.stringify({ id: notificationId }),
      })
    );
    expect(wrong.status).toBe(401);
  });

  it('skips push when the category is turned off', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_notifications')) {
        return jsonResponse([
          {
            id: notificationId,
            type: 'follow',
            actor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            spot_id: null,
            comment_id: null,
            read_at: null,
            created_at: '2026-09-11T00:00:00.000Z',
            recipient_id: recipientId,
            hidden_at: null,
          },
        ]);
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

    const response = await POST(
      new Request('https://app.test/api/push/dispatch', {
        method: 'POST',
        headers: { 'x-push-dispatch-secret': 'dispatch-secret' },
        body: JSON.stringify({
          type: 'INSERT',
          record: { id: notificationId },
        }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      skipped: 'prefs',
    });
  });

  it('sends Expo push and drops stale tokens', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_notifications')) {
        return jsonResponse([
          {
            id: notificationId,
            type: 'follow',
            actor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            spot_id: null,
            comment_id: null,
            read_at: null,
            created_at: '2026-09-11T00:00:00.000Z',
            recipient_id: recipientId,
            hidden_at: null,
          },
        ]);
      }
      if (url.includes('/rest/v1/profiles') && url.includes('push_enabled')) {
        return jsonResponse([
          {
            push_enabled: true,
            notify_social: true,
            notify_campus: true,
            notify_spot_updates: true,
          },
        ]);
      }
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse([{ username: 'mina', avatar_url: null, xp_total: 0 }]);
      }
      if (url.includes('/rest/v1/push_tokens') && init?.method === 'DELETE') {
        expect(decodeURIComponent(url)).toContain(`expo_push_token=eq.${token}`);
        return jsonResponse(null, 200);
      }
      if (url.includes('/rest/v1/push_tokens')) {
        return jsonResponse([{ expo_push_token: token }]);
      }
      if (url.includes('exp.host')) {
        return jsonResponse({
          data: [
            {
              status: 'error',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await POST(
      new Request('https://app.test/api/push/dispatch', {
        method: 'POST',
        headers: { 'x-push-dispatch-secret': 'dispatch-secret' },
        body: JSON.stringify({ id: notificationId }),
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: 0 });
  });
});
