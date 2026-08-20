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
      mockResponse({ comments, commentCount: 4 })
    );

    await useCommentsStore.getState().fetchComments('spot-1');

    const cache = useCommentsStore.getState().bySpotId['spot-1'];
    expect(cache.comments).toEqual(comments);
    expect(cache.loading).toBe(false);
    expect(cache.error).toBeNull();
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
    ).rejects.toThrow('Hang on — still posting.');

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
});
