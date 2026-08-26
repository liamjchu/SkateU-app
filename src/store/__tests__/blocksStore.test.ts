jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

const mockHideCreatorSpots = jest.fn();
const mockHideUserComments = jest.fn();

jest.mock('../spotsStore', () => ({
  useSpotsStore: {
    getState: () => ({ hideCreatorSpots: mockHideCreatorSpots }),
  },
}));

jest.mock('../commentsStore', () => ({
  useCommentsStore: {
    getState: () => ({ hideUserComments: mockHideUserComments }),
  },
}));

import { useBlocksStore } from '../blocksStore';

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    clone: () => ({
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  } as unknown as Response;
}

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  mockHideCreatorSpots.mockReset();
  mockHideUserComments.mockReset();
  useBlocksStore.getState().clear();
});

describe('blocksStore', () => {
  it('loads blocked users', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        users: [{ userId: 'blocked-1', username: 'blocked_skater' }],
      })
    );
    await useBlocksStore.getState().fetchBlocks('token');
    expect(useBlocksStore.getState().users).toEqual([
      { userId: 'blocked-1', username: 'blocked_skater' },
    ]);
    expect(useBlocksStore.getState().loading).toBe(false);
    expect(useBlocksStore.getState().isBlocked('blocked-1')).toBe(true);
  });

  it('stores an error when the list request fails', async () => {
    fetchMock.mockResolvedValue(mockResponse({ error: 'nope' }, false));
    await useBlocksStore.getState().fetchBlocks('token');
    expect(useBlocksStore.getState().error).toBe('nope');
    expect(useBlocksStore.getState().users).toEqual([]);
  });

  it('blocks a user and hides their content', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ user: { userId: 'blocked-1', username: 'blocked_skater' } })
    );
    await useBlocksStore.getState().blockUser('blocked-1', 'token', 'blocked_skater');
    expect(mockHideCreatorSpots).toHaveBeenCalledWith('blocked-1');
    expect(mockHideUserComments).toHaveBeenCalledWith('blocked-1');
    expect(useBlocksStore.getState().isBlocked('blocked-1')).toBe(true);
  });

  it('unblocks a user', async () => {
    useBlocksStore.setState({
      users: [{ userId: 'blocked-1', username: 'blocked_skater' }],
      loading: false,
      error: null,
    });
    fetchMock.mockResolvedValue(mockResponse({}));
    await useBlocksStore.getState().unblockUser('blocked-1', 'token');
    expect(useBlocksStore.getState().isBlocked('blocked-1')).toBe(false);
  });

  it('keeps an already-blocked user and merges persisted rows', async () => {
    useBlocksStore.setState({
      users: [{ userId: 'blocked-1', username: 'blocked_skater' }],
    });
    fetchMock.mockResolvedValue(
      mockResponse({ user: { userId: 'blocked-1', username: 'blocked_skater' } })
    );
    await useBlocksStore.getState().blockUser('blocked-1', 'token');
    expect(useBlocksStore.getState().users).toHaveLength(1);

    const merge = useBlocksStore.persist.getOptions().merge;
    expect(merge).toBeDefined();
    const merged = merge!(
      { users: [{ userId: 'blocked-2', username: null }] },
      useBlocksStore.getState()
    );
    expect(merged.users).toEqual([{ userId: 'blocked-2', username: null }]);
    useBlocksStore.getState().setHasHydrated(true);
    expect(useBlocksStore.getState().hasHydrated).toBe(true);
  });

  it('maps a timed-out list request', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValue(abort);
    await useBlocksStore.getState().fetchBlocks('token');
    expect(useBlocksStore.getState().error).toMatch(/timed out/i);
  });
});
