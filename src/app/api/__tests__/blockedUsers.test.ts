import {
  applyBlockedUserFilter,
  fetchBlockedUserIds,
  fetchReportedCommentIds,
} from '../blockedUsers';

const config = {
  url: 'https://project.supabase.co',
  apiKey: 'service-role-secret-key',
};

const originalFetch = global.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('applyBlockedUserFilter', () => {
  it('does nothing when nobody is blocked', () => {
    const query = new URL('https://project.supabase.co/rest/v1/spots');
    applyBlockedUserFilter(query, 'created_by_user_id', []);
    expect(query.searchParams.get('or')).toBeNull();
  });

  it('keeps null creators and excludes blocked ids', () => {
    const query = new URL('https://project.supabase.co/rest/v1/spots');
    applyBlockedUserFilter(query, 'created_by_user_id', [
      'user-1',
      'user-2',
    ]);
    expect(query.searchParams.get('or')).toBe(
      '(created_by_user_id.is.null,created_by_user_id.not.in.(user-1,user-2))'
    );
  });
});

describe('fetchBlockedUserIds', () => {
  it('returns non-empty blocked ids', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([{ blocked_id: 'user-2' }, { blocked_id: '' }, {}]),
        { status: 200 }
      )
    );
    await expect(fetchBlockedUserIds(config, 'user-1')).resolves.toEqual([
      'user-2',
    ]);
  });

  it('throws the response body when the lookup fails', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(fetchBlockedUserIds(config, 'user-1')).rejects.toThrow('nope');
  });
});

describe('fetchReportedCommentIds', () => {
  it('returns non-empty reported comment ids', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([{ comment_id: 'comment-1' }, { comment_id: 1 }]),
        { status: 200 }
      )
    );
    await expect(fetchReportedCommentIds(config, 'user-1')).resolves.toEqual([
      'comment-1',
    ]);
  });

  it('throws the response body when the lookup fails', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 401 }));
    await expect(fetchReportedCommentIds(config, 'user-1')).rejects.toThrow(
      'down'
    );
  });
});
