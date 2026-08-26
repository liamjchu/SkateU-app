import { COMMENT_PAGE_SIZE } from '../../../lib/commentForm';
import {
    DELETE,
    GET,
    POST,
    mapComment,
    validateCommentBody,
} from '../spot-comments+api';

type FetchMock = jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]>;

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

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

function openAIApprovalResponse(): Response {
  return jsonResponse({
    choices: [
      {
        message: {
          content: JSON.stringify({ approved: true, flag: 'NONE', reason: '' }),
        },
      },
    ],
  });
}

function openAIRejectionResponse(): Response {
  return jsonResponse({
    choices: [
      {
        message: {
          content: JSON.stringify({
            approved: false,
            flag: 'INAPPROPRIATE',
            reason: 'This is not allowed and unsafe.',
          }),
        },
      },
    ],
  });
}

const parentRow = {
  id: '11111111-1111-4111-8111-111111111111',
  spot_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user_id: 'user-1',
  parent_comment_id: null,
  content: 'This spot is sick',
  created_at: '2024-01-01T00:00:00.000Z',
  creator: { username: 'liam' },
};

const replyRow = {
  id: '22222222-2222-4222-8222-222222222222',
  spot_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user_id: 'user-2',
  parent_comment_id: parentRow.id,
  content: 'Yeah this ledge is perfect',
  created_at: '2024-01-01T00:01:00.000Z',
  creator: { username: 'alex' },
};

function makeTopLevelRow(
  index: number,
  overrides: Partial<typeof parentRow> = {}
): typeof parentRow {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    spot_id: parentRow.spot_id,
    user_id: 'user-1',
    parent_comment_id: null,
    content: `Comment ${index}`,
    created_at: `2024-01-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
    creator: { username: 'liam' },
    ...overrides,
  };
}

function sliceTopLevelRows(
  url: URL,
  rows: Array<typeof parentRow>
): Array<typeof parentRow> {
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? COMMENT_PAGE_SIZE);
  return rows.slice(offset, offset + limit);
}

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('mapComment', () => {
  it('maps a database row and nests replies', () => {
    const mapped = mapComment(parentRow, [mapComment(replyRow)]);
    expect(mapped).toEqual({
      id: parentRow.id,
      spotId: parentRow.spot_id,
      userId: 'user-1',
      parentCommentId: null,
      content: 'This spot is sick',
      creatorUsername: 'liam',
      creatorAvatarUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      replies: [
        expect.objectContaining({
          id: replyRow.id,
          parentCommentId: parentRow.id,
          creatorUsername: 'alex',
          replies: [],
        }),
      ],
    });
  });
});

describe('validateCommentBody', () => {
  it('accepts a trimmed top-level comment', () => {
    expect(
      validateCommentBody({
        spotId: parentRow.spot_id,
        content: '  Nice rail.  ',
      })
    ).toEqual({
      ok: true,
      value: {
        spotId: parentRow.spot_id,
        content: 'Nice rail.',
        parentCommentId: null,
      },
    });
  });

  it('rejects empty content and invalid parent ids', () => {
    expect(validateCommentBody({ spotId: parentRow.spot_id, content: '  ' }).ok).toBe(
      false
    );
    expect(
      validateCommentBody({
        spotId: parentRow.spot_id,
        content: 'Nice',
        parentCommentId: '%%%',
      }).ok
    ).toBe(false);
  });
});

describe('GET /api/spot-comments', () => {
  it('returns public nested comments newest-first with oldest-first replies', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: 2 }]);
      }
      if (url.searchParams.get('parent_comment_id') === 'is.null') {
        return jsonResponse([parentRow]);
      }
      return jsonResponse([replyRow]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      commentCount: 2,
      comments: [
        expect.objectContaining({
          id: parentRow.id,
          replies: [expect.objectContaining({ id: replyRow.id })],
        }),
      ],
      nextOffset: 1,
      hasMore: false,
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/'))).toBe(
      false
    );
  });

  it('hides comments from blocked users when signed in', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'viewer-1' });
      }
      if (url.includes('/rest/v1/user_blocks')) {
        return jsonResponse([{ blocked_id: parentRow.user_id }]);
      }
      if (url.includes('/rest/v1/comment_reports')) {
        return jsonResponse([]);
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: 2 }]);
      }
      if (url.includes('parent_comment_id=is.null')) {
        return jsonResponse([parentRow]);
      }
      return jsonResponse([replyRow]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      commentCount: 2,
      comments: [],
      nextOffset: 1,
      hasMore: false,
    });
  });

  it('fills a visible page past hidden comments later in the raw result set', async () => {
    setConfigured();
    const hidden = makeTopLevelRow(0, {
      user_id: 'blocked-user',
      content: 'Hidden first',
    });
    const visible = Array.from({ length: COMMENT_PAGE_SIZE }, (_, index) =>
      makeTopLevelRow(index + 1, { user_id: 'visible-user' })
    );
    const rawRows = [hidden, ...visible];

    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'viewer-1' });
      }
      if (url.pathname.includes('/rest/v1/user_blocks')) {
        return jsonResponse([{ blocked_id: 'blocked-user' }]);
      }
      if (url.pathname.includes('/rest/v1/comment_reports')) {
        return jsonResponse([]);
      }
      if (url.pathname.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: rawRows.length }]);
      }
      if (url.searchParams.get('parent_comment_id') === 'is.null') {
        return jsonResponse(sliceTopLevelRows(url, rawRows));
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      comments: Array<{ id: string; userId: string }>;
      nextOffset: number;
      hasMore: boolean;
    };
    expect(body.comments).toHaveLength(COMMENT_PAGE_SIZE);
    expect(body.comments.map((comment) => comment.id)).toEqual(
      visible.map((row) => row.id)
    );
    expect(body.comments.some((comment) => comment.userId === 'blocked-user')).toBe(
      false
    );
    expect(body.nextOffset).toBe(COMMENT_PAGE_SIZE + 1);
    expect(body.hasMore).toBe(false);
  });

  it('keeps scanning when hidden comments fill whole raw pages', async () => {
    setConfigured();
    const hiddenPage = Array.from({ length: COMMENT_PAGE_SIZE }, (_, index) =>
      makeTopLevelRow(index, { user_id: 'blocked-user' })
    );
    const nextHidden = makeTopLevelRow(COMMENT_PAGE_SIZE, {
      user_id: 'blocked-user',
    });
    const visibleTail = Array.from({ length: 3 }, (_, index) =>
      makeTopLevelRow(COMMENT_PAGE_SIZE + 1 + index, { user_id: 'visible-user' })
    );
    const rawRows = [...hiddenPage, nextHidden, ...visibleTail];

    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'viewer-1' });
      }
      if (url.pathname.includes('/rest/v1/user_blocks')) {
        return jsonResponse([{ blocked_id: 'blocked-user' }]);
      }
      if (url.pathname.includes('/rest/v1/comment_reports')) {
        return jsonResponse([]);
      }
      if (url.pathname.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: rawRows.length }]);
      }
      if (url.searchParams.get('parent_comment_id') === 'is.null') {
        return jsonResponse(sliceTopLevelRows(url, rawRows));
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      comments: Array<{ id: string }>;
      nextOffset: number;
      hasMore: boolean;
    };
    expect(body.comments.map((comment) => comment.id)).toEqual(
      visibleTail.map((row) => row.id)
    );
    expect(body.nextOffset).toBe(rawRows.length);
    expect(body.hasMore).toBe(false);
  });

  it('returns a short terminal page with raw pagination metadata', async () => {
    setConfigured();
    const hidden = makeTopLevelRow(0, { user_id: 'blocked-user' });
    const visible = Array.from({ length: 3 }, (_, index) =>
      makeTopLevelRow(index + 1, { user_id: 'visible-user' })
    );
    const rawRows = [hidden, ...visible];

    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'viewer-1' });
      }
      if (url.pathname.includes('/rest/v1/user_blocks')) {
        return jsonResponse([{ blocked_id: 'blocked-user' }]);
      }
      if (url.pathname.includes('/rest/v1/comment_reports')) {
        return jsonResponse([]);
      }
      if (url.pathname.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: rawRows.length }]);
      }
      if (url.searchParams.get('parent_comment_id') === 'is.null') {
        return jsonResponse(sliceTopLevelRows(url, rawRows));
      }
      return jsonResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`,
        { headers: { Authorization: 'Bearer good-token' } }
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      comments: Array<{ id: string }>;
      nextOffset: number;
      hasMore: boolean;
    };
    expect(body.comments).toHaveLength(visible.length);
    expect(body.comments.length).toBeLessThan(COMMENT_PAGE_SIZE);
    expect(body.nextOffset).toBe(rawRows.length);
    expect(body.hasMore).toBe(false);
  });

  it('returns 400 when spotId is missing', async () => {
    setConfigured();
    const response = await GET(new Request('https://app.test/api/spot-comments'));
    expect(response.status).toBe(400);
  });

  it('returns 404 when the spot does not exist', async () => {
    setConfigured();
    global.fetch = jest.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`
      )
    );
    expect(response.status).toBe(404);
  });

  it('returns 404 when the spot has been removed', async () => {
    setConfigured();
    global.fetch = jest.fn(async () =>
      jsonResponse([{ id: parentRow.spot_id, comments_count: 2, status: 'removed' }])
    ) as unknown as typeof fetch;
    const response = await GET(
      new Request(
        `https://app.test/api/spot-comments?spotId=${parentRow.spot_id}`
      )
    );
    expect(response.status).toBe(404);
  });
});

describe('POST /api/spot-comments', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    setConfigured();
    const response = await POST(
      new Request('https://app.test/api/spot-comments', {
        method: 'POST',
        body: JSON.stringify({
          spotId: parentRow.spot_id,
          content: 'Nice rail.',
        }),
      })
    );
    expect(response.status).toBe(401);
  });

  it('sets user_id from the verified token and returns 201', async () => {
    setConfigured();
    const created = {
      ...parentRow,
      id: '33333333-3333-4333-8333-333333333333',
      user_id: 'user-from-token',
      content: 'Nice rail.',
    };
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-from-token' });
      }
      if (url.includes('api.openai.com')) {
        return openAIApprovalResponse();
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: 3 }]);
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/spot_comments')) {
        const body = JSON.parse(String(init.body)) as { user_id: string };
        expect(body.user_id).toBe('user-from-token');
        return jsonResponse([created]);
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/spot-comments', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({
          spotId: parentRow.spot_id,
          content: 'Nice rail.',
        }),
      })
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      comment: { userId: string };
      commentCount: number;
    };
    expect(body.comment.userId).toBe('user-from-token');
    expect(body.commentCount).toBe(3);
  });

  it('rejects a reply to a reply', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-from-token' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: 2 }]);
      }
      if (url.includes('/rest/v1/spot_comments')) {
        return jsonResponse([replyRow]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/spot-comments', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({
          spotId: parentRow.spot_id,
          content: 'Nested reply',
          parentCommentId: replyRow.id,
        }),
      })
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Replies can only be one level deep.',
    });
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.openai.com'))
    ).toBe(false);
  });

  it('returns 422 and does not insert when moderation rejects', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-from-token' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: 0 }]);
      }
      if (url.includes('api.openai.com')) {
        return openAIRejectionResponse();
      }
      throw new Error(`Unexpected write: ${init?.method ?? 'GET'} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/spot-comments', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({
          spotId: parentRow.spot_id,
          content: 'something rude',
        }),
      })
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as { approved: boolean; reason: string };
    expect(body.approved).toBe(false);
    expect(body.reason).toBe('Let’s keep this one school-friendly and try again.');
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes('/rest/v1/spot_comments') && init?.method === 'POST'
      )
    ).toBe(false);
  });

  it('returns 422 from the cheap filter without calling OpenAI', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      if (String(input).includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-from-token' });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(
      new Request('https://app.test/api/spot-comments', {
        method: 'POST',
        headers: { Authorization: 'Bearer good-token' },
        body: JSON.stringify({
          spotId: parentRow.spot_id,
          content: 'aaaaaaaaaaaa',
        }),
      })
    );
    expect(response.status).toBe(422);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.openai.com'))
    ).toBe(false);
  });
});

describe('DELETE /api/spot-comments', () => {
  it('returns 403 when deleting another user comment', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'someone-else' });
      }
      return jsonResponse([parentRow]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      new Request(`https://app.test/api/spot-comments?id=${parentRow.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(403);
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')
    ).toBe(false);
  });

  it('deletes the caller-owned comment and returns the updated count', async () => {
    setConfigured();
    const fetchMock: FetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return jsonResponse({ id: 'user-1' });
      }
      if (url.includes('/rest/v1/spots')) {
        return jsonResponse([{ id: parentRow.spot_id, comments_count: 0 }]);
      }
      if (init?.method === 'DELETE') {
        return jsonResponse([]);
      }
      return jsonResponse([parentRow]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await DELETE(
      new Request(`https://app.test/api/spot-comments?id=${parentRow.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer good-token' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      commentCount: 0,
      deletedId: parentRow.id,
      spotId: parentRow.spot_id,
      parentCommentId: null,
    });
  });
});
