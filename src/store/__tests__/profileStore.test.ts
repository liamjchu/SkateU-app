process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

type QueryResult = { data: unknown; error: { message: string } | null };

function createQuery(result: QueryResult) {
  const query: {
    select: jest.Mock;
    eq: jest.Mock;
    ilike: jest.Mock;
    neq: jest.Mock;
    maybeSingle: jest.Mock;
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    ilike: jest.fn(),
    neq: jest.fn(),
    maybeSingle: jest.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  return query;
}

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

const mockReplaceCreatorUsername = jest.fn();

jest.mock('../spotsStore', () => ({
  useSpotsStore: {
    getState: () => ({ replaceCreatorUsername: mockReplaceCreatorUsername }),
  },
}));

import { useProfileStore } from '../profileStore';

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  mockFrom.mockReset();
  fetchMock.mockReset();
  mockReplaceCreatorUsername.mockReset();
  useProfileStore.setState({
    profile: null,
    welcomeAboardUserId: null,
    loading: false,
    loaded: false,
    error: null,
  });
});

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as unknown as Response;
}

describe('profileStore.fetchProfile', () => {
  it('loads a public profile and then merges legal acceptance', async () => {
    mockFrom.mockReturnValue(
      createQuery({
        data: {
          id: 'user-1',
          username: 'liam',
          avatar_url: null,
          updated_at: '2026-08-21T00:00:00.000Z',
        },
        error: null,
      })
    );
    fetchMock.mockResolvedValue(
      mockResponse({
        profile: {
          id: 'user-1',
          username: 'liam',
          avatar_url: null,
          updated_at: '2026-08-21T00:00:00.000Z',
          legal_version: '2026-08-20',
          legal_accepted_at: '2026-08-21T00:00:00.000Z',
          age_attested_at: '2026-08-21T00:00:00.000Z',
        },
      })
    );

    await useProfileStore.getState().fetchProfile('user-1', 'token');

    expect(useProfileStore.getState().loaded).toBe(true);
    expect(useProfileStore.getState().profile?.username).toBe('liam');
    expect(useProfileStore.getState().profile?.legal_version).toBe('2026-08-20');
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('treats a missing profile row as loaded', async () => {
    mockFrom.mockReturnValue(createQuery({ data: null, error: null }));
    await useProfileStore.getState().fetchProfile('user-1', 'token');
    expect(useProfileStore.getState()).toMatchObject({
      profile: null,
      loaded: true,
      loading: false,
      error: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a supabase load failure', async () => {
    mockFrom.mockReturnValue(
      createQuery({ data: null, error: { message: 'permission denied' } })
    );
    await useProfileStore.getState().fetchProfile('user-1', 'token');
    expect(useProfileStore.getState().loaded).toBe(false);
    expect(useProfileStore.getState().error).toContain('couldn’t load your profile');
  });

  it('surfaces a legal-acceptance request failure', async () => {
    mockFrom.mockReturnValue(
      createQuery({
        data: {
          id: 'user-1',
          username: 'liam',
          avatar_url: null,
          updated_at: '2026-08-21T00:00:00.000Z',
        },
        error: null,
      })
    );
    fetchMock.mockResolvedValue(mockResponse({ error: 'down' }, false));
    await useProfileStore.getState().fetchProfile('user-1', 'token');
    expect(useProfileStore.getState().loaded).toBe(false);
    expect(useProfileStore.getState().error).toContain('couldn’t load your profile');
  });
});

describe('profileStore.username', () => {
  it('reports availability from a unique lookup', async () => {
    mockFrom.mockReturnValue(createQuery({ data: null, error: null }));
    await expect(
      useProfileStore.getState().isUsernameAvailable('liam')
    ).resolves.toBe(true);

    mockFrom.mockReturnValue(
      createQuery({ data: { id: 'other' }, error: null })
    );
    await expect(
      useProfileStore.getState().isUsernameAvailable('liam', 'user-1')
    ).resolves.toBe(false);
  });

  it('claims a username and rewrites spot attribution when it changes', async () => {
    useProfileStore.setState({
      profile: {
        id: 'user-1',
        username: 'oldname',
        avatar_url: null,
        updated_at: null,
        legal_version: '2026-08-20',
        legal_accepted_at: '2026-08-21T00:00:00.000Z',
        age_attested_at: '2026-08-21T00:00:00.000Z',
      },
      loaded: true,
      loading: false,
      error: null,
      welcomeAboardUserId: null,
    });
    fetchMock.mockResolvedValue(
      mockResponse({
        allowed: true,
        profile: {
          id: 'user-1',
          username: 'newname',
          avatar_url: null,
          updated_at: '2026-08-21T00:00:00.000Z',
        },
      })
    );

    await expect(
      useProfileStore.getState().claimUsername('token', 'newname', true)
    ).resolves.toEqual({ ok: true });
    expect(useProfileStore.getState().profile?.username).toBe('newname');
    expect(useProfileStore.getState().welcomeAboardUserId).toBe('user-1');
    expect(mockReplaceCreatorUsername).toHaveBeenCalledWith('oldname', 'newname');
  });

  it('returns a taken result without throwing', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ allowed: false, taken: true, reason: 'That username is already taken.' })
    );
    await expect(
      useProfileStore.getState().claimUsername('token', 'liam')
    ).resolves.toEqual({
      ok: false,
      taken: true,
      message: 'That username is already taken.',
    });
  });
});

describe('profileStore.acceptLegal', () => {
  it('stores the merged profile after agreement', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        profile: {
          id: 'user-1',
          username: 'liam',
          avatar_url: null,
          updated_at: '2026-08-21T00:00:00.000Z',
          legal_version: '2026-08-20',
          legal_accepted_at: '2026-08-21T00:00:00.000Z',
          age_attested_at: '2026-08-21T00:00:00.000Z',
        },
      })
    );
    await useProfileStore.getState().acceptLegal('token');
    expect(useProfileStore.getState().profile?.legal_version).toBe('2026-08-20');
    expect(useProfileStore.getState().loaded).toBe(true);
  });

  it('clears in-flight state', () => {
    useProfileStore.setState({
      profile: {
        id: 'user-1',
        username: 'liam',
        avatar_url: null,
        updated_at: null,
        legal_version: null,
        legal_accepted_at: null,
        age_attested_at: null,
      },
      loaded: true,
      loading: true,
      error: 'x',
      welcomeAboardUserId: 'user-1',
    });
    useProfileStore.getState().clearProfile();
    expect(useProfileStore.getState()).toMatchObject({
      profile: null,
      loaded: false,
      loading: false,
      error: null,
      welcomeAboardUserId: null,
    });
  });
});
