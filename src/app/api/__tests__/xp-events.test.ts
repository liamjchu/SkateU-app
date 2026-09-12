import { GET, mapXpEvent } from '../xp-events+api';

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

describe('mapXpEvent', () => {
  it('maps a like event with a spot name', () => {
    expect(
      mapXpEvent({
        id: 'event-1',
        delta: 5,
        reason: 'like_received',
        spot_id: 'spot-1',
        created_at: '2026-09-09T00:00:00.000Z',
        spot: { name: 'Library Ledge' },
      })
    ).toEqual({
      id: 'event-1',
      delta: 5,
      reason: 'like_received',
      spotId: 'spot-1',
      spotName: 'Library Ledge',
      createdAt: '2026-09-09T00:00:00.000Z',
      summary: '+5 · Like on “Library Ledge”',
    });
  });

  it('ignores unknown reasons', () => {
    expect(
      mapXpEvent({
        id: 'event-1',
        delta: 3,
        reason: 'follow_received',
        spot_id: null,
        created_at: '2026-09-09T00:00:00.000Z',
        spot: null,
      })
    ).toBeNull();
  });
});

describe('GET /api/xp-events', () => {
  it('returns 401 without a bearer token', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/xp-events'));
    expect(response.status).toBe(401);
  });

  it('returns the signed-in user’s events', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/xp_events')) {
        expect(url).toContain('user_id=eq.user-1');
        return jsonResponse([
          {
            id: 'event-1',
            delta: 10,
            reason: 'spot_approved',
            spot_id: 'spot-1',
            created_at: '2026-09-09T00:00:00.000Z',
            spot: { name: 'Rail' },
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as FetchMock;

    const response = await GET(
      new Request('https://app.test/api/xp-events', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          id: 'event-1',
          delta: 10,
          reason: 'spot_approved',
          spotId: 'spot-1',
          spotName: 'Rail',
          createdAt: '2026-09-09T00:00:00.000Z',
          summary: '+10 · Approved “Rail”',
        },
      ],
    });
  });
});
