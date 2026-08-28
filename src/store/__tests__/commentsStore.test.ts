import type { SpotComment } from '../../types/comment';
import type { Spot } from '../../types/spot';
import { useCommentsStore } from '../commentsStore';
import { useSpotsStore } from '../spotsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

function mockResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number }
): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone: () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  } as unknown as Response;
}

const fetchMock = jest.fn();

function makeComment(overrides: Partial<SpotComment> = {}): SpotComment {
  return {
    id: 'comment-1',
    spotId: 'spot-1',
    userId: 'user-1',
    parentCommentId: null,
    content: 'This ledge is perfect',
    creatorUsername: 'liam',
    creatorAvatarUrl: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    replies: [],
    ...overrides,
  };
}

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'spot-1',
    name: 'Rail',
    description: 'A rail',
    latitude: 10,
    longitude: 20,
    imageUris: [],
    city: 'Austin',
    state: 'TX',
    schoolName: 'UT Austin',
    creatorUsername: 'skater_jane',
    creatorAvatarUrl: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    commentCount: 0,
    ...overrides,
  };
}

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  useCommentsStore.getState().reset();
  useSpotsStore.getState().reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('commentsStore', () => {
  it('loads comments for a spot and syncs the count onto spots', async () => {
    useSpotsStore.setState({ spots: [makeSpot()] });
    const comments = [makeComment()];
    fetchMock.mockResolvedValue(
      mockResponse({ comments, commentCount: 4, nextOffset: 1, hasMore: false })
    );

    await useCommentsStore.getState().fetchComments('spot-1');

    const cache = useCommentsStore.getState().bySpotId['spot-1'];
    expect(cache.comments).toEqual(comments);
    expect(useCommentsStore.getState().recentSpotIds).toEqual(['spot-1']);
    expect(cache.loading).toBe(false);
    expect(cache.error).toBeNull();
    expect(cache.hasMore).toBe(false);
    expect(cache.nextOffset).toBe(1);
    expect(cache.commentCount).toBe(4);
    expect(useCommentsStore.getState().commentCounts['spot-1']).toBe(4);
    expect(useSpotsStore.getState().spots[0].commentCount).toBe(4);
  });

  it('preserves previously loaded comments when a fetch fails', async () => {
    const existing = [makeComment()];
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: existing,
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 1,
          commentCount: 1,
        },
      },
    });
    fetchMock.mockResolvedValue(
      mockResponse({ error: 'boom' }, { ok: false, status: 500 })
    );

    await useCommentsStore.getState().fetchComments('spot-1');

    const cache = useCommentsStore.getState().bySpotId['spot-1'];
    expect(cache.comments).toEqual(existing);
    expect(cache.loading).toBe(false);
    expect(cache.error).toBeTruthy();
  });

  it('does not post twice while a submit is already in flight', async () => {
    let resolvePost: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvePost = resolve;
        })
    );

    const first = useCommentsStore
      .getState()
      .addComment('spot-1', 'Nice rail', 'token');
    await Promise.resolve();
    await expect(
      useCommentsStore.getState().addComment('spot-1', 'Second', 'token')
    ).rejects.toThrow('Still posting. Please wait.');

    resolvePost?.(
      mockResponse({ comment: makeComment(), commentCount: 1 }, { status: 201 })
    );
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('inserts a reply under its parent and updates the count', async () => {
    const parent = makeComment();
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [parent],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 1,
          commentCount: 1,
        },
      },
    });
    useSpotsStore.setState({ spots: [makeSpot({ commentCount: 1 })] });

    const reply = makeComment({
      id: 'reply-1',
      parentCommentId: parent.id,
      content: 'Agreed',
      creatorUsername: 'alex',
    });
    fetchMock.mockResolvedValue(
      mockResponse({ comment: reply, commentCount: 2 }, { status: 201 })
    );

    await useCommentsStore
      .getState()
      .addComment('spot-1', 'Agreed', 'token', parent.id);

    const cache = useCommentsStore.getState().bySpotId['spot-1'];
    expect(cache.comments[0].replies).toEqual([
      expect.objectContaining({ id: 'reply-1', content: 'Agreed' }),
    ]);
    expect(cache.commentCount).toBe(2);
    expect(useSpotsStore.getState().spots[0].commentCount).toBe(2);
  });

  it('removes a deleted comment and syncs the count', async () => {
    const parent = makeComment();
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [parent],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 1,
          commentCount: 1,
        },
      },
    });
    useSpotsStore.setState({
      spots: [makeSpot({ commentCount: 1 })],
      mySpots: [makeSpot({ commentCount: 1 })],
    });
    fetchMock.mockResolvedValue(mockResponse({ commentCount: 0 }));

    await useCommentsStore.getState().deleteComment('spot-1', parent.id, 'token');

    expect(useCommentsStore.getState().bySpotId['spot-1'].comments).toEqual([]);
    expect(useSpotsStore.getState().spots[0].commentCount).toBe(0);
    expect(useSpotsStore.getState().mySpots[0].commentCount).toBe(0);
  });

  it('hides comments and replies from a blocked user', () => {
    const parent = makeComment({ userId: 'blocked-user' });
    const other = makeComment({
      id: 'comment-2',
      userId: 'other-user',
      replies: [makeComment({ id: 'reply-1', userId: 'blocked-user' })],
    });
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [parent, other],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 2,
          commentCount: 3,
        },
      },
    });

    useCommentsStore.getState().hideUserComments('blocked-user');

    expect(useCommentsStore.getState().bySpotId['spot-1'].comments).toEqual([
      expect.objectContaining({ id: 'comment-2', replies: [] }),
    ]);
  });

  it('loads the next page and skips a fetch when there is no more', async () => {
    const first = makeComment({ id: 'comment-1' });
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [first],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: true,
          nextOffset: 1,
          commentCount: 2,
        },
      },
    });
    fetchMock.mockResolvedValue(
      mockResponse({
        comments: [makeComment({ id: 'comment-2', content: 'Second' })],
        commentCount: 2,
        nextOffset: 3,
        hasMore: false,
      })
    );

    await useCommentsStore.getState().fetchMore('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1'].comments).toHaveLength(2);
    expect(useCommentsStore.getState().bySpotId['spot-1'].hasMore).toBe(false);
    expect(useCommentsStore.getState().bySpotId['spot-1'].nextOffset).toBe(3);

    fetchMock.mockClear();
    await useCommentsStore.getState().fetchMore('spot-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses server nextOffset and hasMore instead of the visible page length', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        comments: [makeComment()],
        commentCount: 40,
        nextOffset: 26,
        hasMore: true,
      })
    );

    await useCommentsStore.getState().fetchComments('spot-1');

    const first = useCommentsStore.getState().bySpotId['spot-1'];
    expect(first.comments).toHaveLength(1);
    expect(first.nextOffset).toBe(26);
    expect(first.hasMore).toBe(true);

    fetchMock.mockResolvedValue(
      mockResponse({
        comments: [makeComment({ id: 'comment-2' })],
        commentCount: 40,
        nextOffset: 51,
        hasMore: true,
      })
    );

    await useCommentsStore.getState().fetchMore('spot-1');

    const cache = useCommentsStore.getState().bySpotId['spot-1'];
    expect(fetchMock.mock.calls[1][0]).toContain('offset=26');
    expect(cache.comments.map((comment) => comment.id)).toEqual([
      'comment-1',
      'comment-2',
    ]);
    expect(cache.nextOffset).toBe(51);
    expect(cache.hasMore).toBe(true);
  });

  it('skips duplicate top-level comments when a page is retried', async () => {
    const first = makeComment({ id: 'comment-1' });
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [first],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: true,
          nextOffset: 1,
          commentCount: 3,
        },
      },
    });
    fetchMock.mockResolvedValue(
      mockResponse({
        comments: [first, makeComment({ id: 'comment-2' })],
        commentCount: 3,
        nextOffset: 3,
        hasMore: false,
      })
    );

    await useCommentsStore.getState().fetchMore('spot-1');

    expect(useCommentsStore.getState().bySpotId['spot-1'].comments.map((comment) => comment.id)).toEqual(
      ['comment-1', 'comment-2']
    );
  });

  it('maps a 401 load failure to a log-in message', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: '' }, { ok: false, status: 401 })
    );
    await useCommentsStore.getState().fetchComments('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1'].error).toBe(
      'Please log in again.'
    );
  });

  it('hides one comment and can reset a spot cache', () => {
    const parent = makeComment();
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [parent],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 1,
          commentCount: 1,
        },
      },
      commentCounts: { 'spot-1': 1 },
    });

    useCommentsStore.getState().hideComment('spot-missing', parent.id);
    expect(useCommentsStore.getState().bySpotId['spot-1'].comments).toHaveLength(1);

    useCommentsStore.getState().hideComment('spot-1', parent.id);
    expect(useCommentsStore.getState().bySpotId['spot-1'].comments).toEqual([]);

    useCommentsStore.getState().resetSpot('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1']).toBeUndefined();
    expect(useCommentsStore.getState().commentCounts['spot-1']).toBeUndefined();
  });

  it('surfaces a timeout and a generic load failure', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abort);
    await useCommentsStore.getState().fetchComments('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1'].error).toMatch(/timed out/i);

    fetchMock.mockRejectedValueOnce('down');
    await useCommentsStore.getState().fetchComments('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1'].error).toBeTruthy();
  });

  it('uses the server reason when a page request fails', async () => {
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [makeComment()],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: true,
          nextOffset: 1,
          commentCount: 1,
        },
      },
    });
    fetchMock.mockResolvedValue(
      mockResponse({ reason: 'Try again.' }, { ok: false, status: 400 })
    );
    await useCommentsStore.getState().fetchMore('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1'].error).toBe('Try again.');
    expect(useCommentsStore.getState().bySpotId['spot-1'].loadingMore).toBe(false);
  });

  it('rejects a successful post that omitted the comment', async () => {
    fetchMock.mockResolvedValue(mockResponse({ commentCount: 1 }, { status: 201 }));
    await expect(
      useCommentsStore.getState().addComment('spot-1', 'Nice rail', 'token')
    ).rejects.toThrow('The server did not return the comment.');
  });

  it('merges persisted comment pages for recently viewed spots', () => {
    const merge = useCommentsStore.persist.getOptions().merge;
    expect(merge).toBeDefined();
    const merged = merge!(
      {
        recentSpotIds: ['spot-1', 2, 'spot-missing'],
        bySpotId: {
          'spot-1': {
            comments: [makeComment()],
            hasMore: false,
            nextOffset: 1,
            commentCount: 1,
          },
        },
      },
      useCommentsStore.getState()
    );
    expect(merged.recentSpotIds).toEqual(['spot-1', 'spot-missing']);
    expect(merged.bySpotId['spot-1']?.comments[0]?.id).toBe('comment-1');
    expect(merged.commentCounts['spot-1']).toBe(1);
    expect(merged.bySpotId['spot-missing']).toBeUndefined();
    expect(merge!(null, useCommentsStore.getState()).recentSpotIds).toEqual([]);
    useCommentsStore.getState().setHasHydrated(true);
    expect(useCommentsStore.getState().hasHydrated).toBe(true);
  });

  it('maps server failures and a timed-out post', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: '' }, { ok: false, status: 500 })
    );
    await useCommentsStore.getState().fetchComments('spot-1');
    expect(useCommentsStore.getState().bySpotId['spot-1'].error).toMatch(
      /temporarily unavailable/i
    );

    fetchMock.mockResolvedValueOnce(
      mockResponse({ error: 'nope' }, { ok: false, status: 400 })
    );
    await expect(
      useCommentsStore.getState().deleteComment('spot-1', 'comment-1', 'token')
    ).rejects.toThrow('nope');

    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abort);
    await expect(
      useCommentsStore.getState().addComment('spot-1', 'Nice rail', 'token')
    ).rejects.toThrow(/timed out/i);
  });

  it('skips inserting a reply that is already present', async () => {
    const parent = makeComment({
      replies: [makeComment({ id: 'reply-1', parentCommentId: 'comment-1' })],
    });
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [parent],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 1,
          commentCount: 2,
        },
      },
    });
    fetchMock.mockResolvedValue(
      mockResponse(
        {
          comment: makeComment({
            id: 'reply-1',
            parentCommentId: 'comment-1',
            content: 'Agreed',
          }),
          commentCount: 2,
        },
        { status: 201 }
      )
    );
    await useCommentsStore
      .getState()
      .addComment('spot-1', 'Agreed', 'token', parent.id);
    expect(useCommentsStore.getState().bySpotId['spot-1'].comments[0].replies).toHaveLength(
      1
    );
  });

  it('rewrites cached avatars for a user and their replies', () => {
    const avatarUrl =
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/a.jpg';
    useCommentsStore.setState({
      bySpotId: {
        'spot-1': {
          comments: [
            makeComment({
              replies: [
                makeComment({
                  id: 'reply-1',
                  userId: 'user-1',
                  parentCommentId: 'comment-1',
                }),
              ],
            }),
            makeComment({ id: 'comment-2', userId: 'user-2' }),
          ],
          loading: false,
          loadingMore: false,
          submitting: false,
          error: null,
          hasMore: false,
          nextOffset: 1,
          commentCount: 3,
        },
      },
    });

    useCommentsStore.getState().replaceCreatorAvatar('user-1', avatarUrl);
    const comments = useCommentsStore.getState().bySpotId['spot-1'].comments;
    expect(comments[0]?.creatorAvatarUrl).toBe(avatarUrl);
    expect(comments[0]?.replies[0]?.creatorAvatarUrl).toBe(avatarUrl);
    expect(comments[1]?.creatorAvatarUrl).toBeNull();
  });
});
