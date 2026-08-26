import { mapCommentReport, POST } from '../comment-reports+api';

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
const authorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const commentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const spotId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('mapCommentReport', () => {
  it('falls back to other and empty strings for incomplete rows', () => {
    expect(
      mapCommentReport({
        id: 'report-1',
        comment_id: commentId,
        reason: 'not-a-reason',
        details: undefined as unknown as string,
        created_at: undefined as unknown as string,
      })
    ).toEqual({
      id: 'report-1',
      commentId,
      reason: 'other',
      details: '',
      createdAt: '',
    });
  });
});

describe('POST /api/comment-reports', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        body: JSON.stringify({ commentId, reason: 'spam' }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('returns 500 when comment reports are not configured', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ commentId, reason: 'spam' }),
      })
    );
    expect(response.status).toBe(500);
  });

  it('returns 401 when the access token is rejected', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'invalid' }, 401)
    ) as unknown as typeof fetch;
    const response = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        headers: { Authorization: 'Bearer bad-token' },
        body: JSON.stringify({ commentId, reason: 'spam' }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('rejects reporting your own comment', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/spot_comments')) {
        return jsonResponse([
          { id: commentId, spot_id: spotId, user_id: viewerId, content: 'hi' },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ commentId, reason: 'spam' }),
      })
    );
    expect(response.status).toBe(400);
  });

  it('rejects a malformed body and a missing comment', async () => {
    setConfigured();
    global.fetch = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/spot_comments')) {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const malformed = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: '{',
      })
    );
    expect(malformed.status).toBe(400);

    const missing = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ commentId, reason: 'spam' }),
      })
    );
    expect(missing.status).toBe(404);
  });

  it('creates a report and emails moderation', async () => {
    setConfigured();
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM_EMAIL = 'SkateU <alerts@skateu.app>';
    process.env.MODERATION_NOTIFY_EMAIL = 'mod@skateu.app';

    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: viewerId });
      }
      if (url.includes('/rest/v1/spot_comments')) {
        return jsonResponse([
          {
            id: commentId,
            spot_id: spotId,
            user_id: authorId,
            content: 'spam comment',
          },
        ]);
      }
      if (
        url.includes('/rest/v1/comment_reports') &&
        url.includes('comment_id=eq')
      ) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/comment_reports') && url.includes('created_at')) {
        return jsonResponse([]);
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/comment_reports')) {
        return jsonResponse([
          {
            id: 'report-1',
            comment_id: commentId,
            reason: 'spam',
            details: '',
            created_at: '2026-08-21T00:00:00.000Z',
          },
        ]);
      }
      if (url.includes('api.resend.com')) {
        return jsonResponse({ id: 'email-1' });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/comment-reports', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({ commentId, reason: 'spam' }),
      })
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { report: { commentId: string } };
    expect(body.report.commentId).toBe(commentId);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.resend.com'))
    ).toBe(true);
  });
});
