import {
  GET,
  POST,
  mapRemovalRequest,
} from '../spot-removal-requests+api';
import { SPOT_REMOVAL_DETAILS_MAX } from '../../../lib/spotRemovalRequest';

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

const requestRow = {
  id: 'req-1',
  spot_id: 'spot-1',
  reason: 'dangerous',
  details: 'Rusty bolts',
  created_at: '2026-08-19T12:00:00.000Z',
};

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('mapRemovalRequest', () => {
  it('maps a database row to the client shape', () => {
    expect(mapRemovalRequest(requestRow)).toEqual({
      id: 'req-1',
      spotId: 'spot-1',
      reason: 'dangerous',
      details: 'Rusty bolts',
      createdAt: '2026-08-19T12:00:00.000Z',
    });
  });
});

describe('GET /api/spot-removal-requests', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await GET(
      new Request('https://app.test/api/spot-removal-requests?spotId=spot-1')
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when the spot id is invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spot-removal-requests?spotId=bad id', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(400);
  });

  it('returns the caller’s request or null', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([requestRow]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request('https://app.test/api/spot-removal-requests?spotId=spot-1', {
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      request: {
        id: 'req-1',
        spotId: 'spot-1',
        reason: 'dangerous',
        details: 'Rusty bolts',
        createdAt: '2026-08-19T12:00:00.000Z',
      },
    });

    const requestUrl = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes('/rest/v1/spot_removal_requests'));
    expect(requestUrl).toContain('user_id=eq.user-1');
    expect(requestUrl).toContain('spot_id=eq.spot-1');
  });
});

describe('POST /api/spot-removal-requests', () => {
  function postRequest(body: unknown): Request {
    return new Request('https://app.test/api/spot-removal-requests', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer good-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/spot-removal-requests', {
        method: 'POST',
        body: JSON.stringify({ spotId: 'spot-1', reason: 'dangerous' }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when the reason is invalid', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ spotId: 'spot-1', reason: 'nope' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Choose what’s wrong with this spot.',
    });
  });

  it('returns 400 when details are too long', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'user-1' })
    ) as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        spotId: 'spot-1',
        reason: 'other',
        details: 'a'.repeat(SPOT_REMOVAL_DETAILS_MAX + 1),
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain(String(SPOT_REMOVAL_DETAILS_MAX));
  });

  it('accepts empty details', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots') && init?.method !== 'PATCH') {
        return jsonResponse([
          { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'active' },
        ]);
      }
      if (url.includes('/rest/v1/spot_removal_requests') && init?.method === 'POST') {
        return jsonResponse([{ ...requestRow, details: '' }], 201);
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'duplicate', details: '' })
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { request: { details: string } };
    expect(body.request.details).toBe('');
  });

  it('returns 404 when the spot is missing', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(404);
  });

  it('returns 404 when the spot is removed', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([
        { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'removed' },
      ]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(404);
  });

  it('returns 400 when the caller owns the spot', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      return jsonResponse([
        { created_by_user_id: 'user-1', school_id: 'school-1', status: 'active' },
      ]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'You can delete your own spots instead.',
    });
  });

  it('returns the existing request when the caller already submitted one', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([
          { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'active' },
        ]);
      }
      if (url.includes('/rest/v1/spot_removal_requests') && init?.method !== 'POST') {
        return jsonResponse([requestRow]);
      }
      throw new Error('insert should not run');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { alreadySubmitted: boolean };
    expect(body.alreadySubmitted).toBe(true);
  });

  it('returns 429 when the daily cap is reached', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([
          { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'active' },
        ]);
      }
      if (url.includes('/rest/v1/spot_removal_requests') && init?.method !== 'POST') {
        if (url.includes('created_at=gte.')) {
          return jsonResponse(Array.from({ length: 10 }, (_, index) => ({ id: `r${index}` })));
        }
        return jsonResponse([]);
      }
      throw new Error('insert should not run');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(429);
  });

  it('sets user_id from the verified token and never from the body', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots') && init?.method !== 'PATCH') {
        return jsonResponse([
          { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'active' },
        ]);
      }
      if (url.includes('/rest/v1/spot_removal_requests') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { user_id: string };
        expect(payload.user_id).toBe('user-1');
        expect(payload).not.toHaveProperty('status');
        return jsonResponse([requestRow], 201);
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({
        spotId: 'spot-1',
        reason: 'dangerous',
        userId: 'attacker',
        status: 'under_review',
      })
    );
    expect(response.status).toBe(201);
  });

  it('treats a unique-constraint conflict as already submitted', async () => {
    setConfigured();
    let requestLookups = 0;
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([
          { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'active' },
        ]);
      }
      if (url.includes('/rest/v1/spot_removal_requests') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            code: '23505',
            message: 'duplicate key value violates unique constraint',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/rest/v1/spot_removal_requests')) {
        requestLookups += 1;
        return jsonResponse(requestLookups === 1 ? [] : [requestRow]);
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { alreadySubmitted: boolean };
    expect(body.alreadySubmitted).toBe(true);
  });

  it('claims a review notification once when the spot is under_review', async () => {
    setConfigured();
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'SkateU <hello@example.com>';
    process.env.MODERATION_NOTIFY_EMAIL = 'owner@example.com';

    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('api.resend.com')) {
        return jsonResponse({ id: 'email-1' });
      }
      if (url.includes('/rest/v1/spots') && init?.method === 'PATCH') {
        expect(url).toContain('status=eq.under_review');
        expect(url).toContain('review_notified_at=is.null');
        return jsonResponse([{ id: 'spot-1' }]);
      }
      if (url.includes('/rest/v1/spots')) {
        if (url.includes('created_by_user_id') || url.includes('select=created_by')) {
          return jsonResponse([
            { created_by_user_id: 'owner-1', school_id: 'school-1', status: 'active' },
          ]);
        }
        return jsonResponse([
          {
            id: 'spot-1',
            name: 'Davis Gap',
            status: 'under_review',
            reviewed_at: null,
            review_notified_at: null,
            schools: { name: 'UC Davis' },
          },
        ]);
      }
      if (url.includes('/rest/v1/spot_removal_requests') && init?.method === 'POST') {
        return jsonResponse([requestRow], 201);
      }
      if (url.includes('/rest/v1/spot_removal_requests')) {
        if (url.includes('created_at=gte.')) {
          return jsonResponse([]);
        }
        if (url.includes('user_id=eq.user-1') && !url.includes('order=')) {
          return jsonResponse([]);
        }
        return jsonResponse([
          requestRow,
          { ...requestRow, id: 'req-2', reason: 'private_restricted', details: '' },
        ]);
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      postRequest({ spotId: 'spot-1', reason: 'dangerous' })
    );
    expect(response.status).toBe(201);

    const resendCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('api.resend.com')
    );
    expect(resendCalls).toHaveLength(1);
    const emailBody = JSON.parse(String(resendCalls[0][1]?.body)) as {
      subject: string;
      to: string[];
    };
    expect(emailBody.subject).toBe('SkateU spot needs review');
    expect(emailBody.to).toEqual(['owner@example.com']);
  });
});
