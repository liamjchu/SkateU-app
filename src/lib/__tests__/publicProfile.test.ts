import {
  fetchCreatorSpots,
  fetchFollowList,
  fetchPublicProfileView,
  followListUserAsProfile,
  followUser,
  mapFollowListUsers,
  mapFollowStats,
  mapPublicProfileView,
  unfollowUser,
} from '../publicProfile';
import type { PublicProfileView } from '../../types/publicProfile';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const originalFetch = global.fetch;
const fetchMock = jest.fn();

const profile: PublicProfileView = {
  id: userId,
  username: 'skater_jane',
  avatarUrl: null,
  bio: null,
  followerCount: 1,
  followingCount: 2,
  isFollowing: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('mapPublicProfileView', () => {
  it('maps a complete payload', () => {
    expect(
      mapPublicProfileView({
        profile: {
          id: userId,
          username: 'skater_jane',
          avatarUrl:
            'https://project.supabase.co/storage/v1/object/public/avatars/a.jpg',
          bio: 'Skater at State',
        },
        followerCount: 3,
        followingCount: 8,
        isFollowing: true,
      })
    ).toEqual({
      id: userId,
      username: 'skater_jane',
      avatarUrl:
        'https://project.supabase.co/storage/v1/object/public/avatars/a.jpg',
      bio: 'Skater at State',
      followerCount: 3,
      followingCount: 8,
      isFollowing: true,
    });
  });

  it('rejects malformed payloads and empty ids', () => {
    expect(mapPublicProfileView(null)).toBeNull();
    expect(mapPublicProfileView([])).toBeNull();
    expect(mapPublicProfileView({ profile: { username: 'jane' } })).toBeNull();
    expect(mapPublicProfileView({ profile: { id: '' } })).toBeNull();
    expect(mapPublicProfileView({ profile: [] })).toBeNull();
  });

  it('defaults optional fields and invalid counts', () => {
    expect(
      mapPublicProfileView({
        profile: { id: userId, username: '', bio: '', avatarUrl: 1 },
        followerCount: -3,
        followingCount: Number.NaN,
        isFollowing: 'yes',
      })
    ).toEqual({
      id: userId,
      username: null,
      avatarUrl: null,
      bio: null,
      followerCount: 0,
      followingCount: 0,
      isFollowing: false,
    });
  });
});

describe('mapFollowStats', () => {
  it('overlays counts onto the current profile', () => {
    expect(
      mapFollowStats(
        { followerCount: 4.8, followingCount: 2, isFollowing: true },
        profile
      )
    ).toEqual({
      ...profile,
      followerCount: 4,
      isFollowing: true,
    });
  });

  it('returns the current profile when the payload is not an object', () => {
    expect(mapFollowStats(null, profile)).toEqual(profile);
    expect(mapFollowStats([], profile)).toEqual(profile);
  });
});

describe('mapFollowListUsers', () => {
  it('maps a complete list payload', () => {
    expect(
      mapFollowListUsers({
        users: [
          {
            id: userId,
            username: 'skater_jane',
            avatarUrl:
              'https://project.supabase.co/storage/v1/object/public/avatars/a.jpg',
            isFollowing: true,
          },
        ],
      })
    ).toEqual([
      {
        id: userId,
        username: 'skater_jane',
        avatarUrl:
          'https://project.supabase.co/storage/v1/object/public/avatars/a.jpg',
        isFollowing: true,
      },
    ]);
  });

  it('rejects invalid list payloads', () => {
    expect(mapFollowListUsers(null)).toBeNull();
    expect(mapFollowListUsers({ users: 'nope' })).toBeNull();
    expect(mapFollowListUsers({ users: [{ username: 'jane' }] })).toBeNull();
    expect(
      mapFollowListUsers({ users: [{ id: '', username: 'jane' }] })
    ).toBeNull();
  });

  it('defaults missing username and avatar', () => {
    expect(
      mapFollowListUsers({
        users: [{ id: userId, username: '', isFollowing: false }],
      })
    ).toEqual([
      {
        id: userId,
        username: null,
        avatarUrl: null,
        isFollowing: false,
      },
    ]);
  });
});

describe('followListUserAsProfile', () => {
  it('lifts a follow-list row into a public profile view', () => {
    expect(
      followListUserAsProfile({
        id: userId,
        username: 'skater_jane',
        avatarUrl: null,
        isFollowing: true,
      })
    ).toEqual({
      id: userId,
      username: 'skater_jane',
      avatarUrl: null,
      bio: null,
      followerCount: 0,
      followingCount: 0,
      isFollowing: true,
    });
  });
});

describe('fetchPublicProfileView', () => {
  it('returns a mapped profile and sends a bearer token when present', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        profile: { id: userId, username: 'skater_jane' },
        followerCount: 1,
        followingCount: 0,
        isFollowing: false,
      })
    );

    await expect(fetchPublicProfileView(userId, 'token')).resolves.toMatchObject({
      id: userId,
      username: 'skater_jane',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8081/api/profiles?userId=${userId}`,
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      })
    );
  });

  it('omits auth headers for guests', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ profile: { id: userId, username: 'skater_jane' } })
    );
    await fetchPublicProfileView(userId);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();
  });

  it('uses the API error when the body is JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 404));
    await expect(fetchPublicProfileView(userId)).rejects.toThrow('nope');
  });

  it('falls back when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 500 }));
    await expect(fetchPublicProfileView(userId)).rejects.toThrow(
      'Couldn’t load that profile right now.'
    );
  });

  it('rejects an unmappable success payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: {} }));
    await expect(fetchPublicProfileView(userId)).rejects.toThrow(
      'Couldn’t load that profile right now.'
    );
  });
});

describe('fetchFollowList', () => {
  it('returns mapped users', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ users: [{ id: userId, username: 'skater_jane' }] })
    );
    await expect(
      fetchFollowList(userId, 'followers', 'token')
    ).resolves.toEqual([
      {
        id: userId,
        username: 'skater_jane',
        avatarUrl: null,
        isFollowing: false,
      },
    ]);
  });

  it('throws API and mapping failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 500));
    await expect(fetchFollowList(userId, 'following')).rejects.toThrow('nope');

    fetchMock.mockResolvedValueOnce(jsonResponse({ users: [{ id: '' }] }));
    await expect(fetchFollowList(userId, 'followers')).rejects.toThrow(
      'Couldn’t load that list right now.'
    );
  });
});

describe('followUser and unfollowUser', () => {
  it('follows and overlays returned stats', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ followerCount: 9, followingCount: 2, isFollowing: true })
    );
    await expect(followUser(userId, 'token', profile)).resolves.toEqual({
      ...profile,
      followerCount: 9,
      isFollowing: true,
    });
  });

  it('unfollows and overlays returned stats', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ followerCount: 0, followingCount: 2, isFollowing: false })
    );
    await expect(
      unfollowUser(userId, 'token', { ...profile, isFollowing: true })
    ).resolves.toEqual({
      ...profile,
      followerCount: 0,
      isFollowing: false,
    });
  });

  it('throws follow and unfollow failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'blocked' }, 403));
    await expect(followUser(userId, 'token', profile)).rejects.toThrow(
      'blocked'
    );

    fetchMock.mockResolvedValueOnce(new Response('down', { status: 500 }));
    await expect(unfollowUser(userId, 'token', profile)).rejects.toThrow(
      'Couldn’t unfollow that skater right now.'
    );
  });
});

describe('fetchCreatorSpots', () => {
  it('returns spots from the payload', async () => {
    const spots = [
      {
        id: 'spot-1',
        name: 'Ledge',
        description: '',
        latitude: 1,
        longitude: 2,
        imageUris: [],
        city: 'Davis',
        state: 'CA',
        schoolName: 'UC Davis',
        creatorUsername: 'skater_jane',
        creatorAvatarUrl: null,
        createdAt: '',
        updatedAt: '',
      },
    ];
    fetchMock.mockResolvedValue(jsonResponse({ spots }));
    await expect(fetchCreatorSpots(userId, 'token')).resolves.toEqual(spots);
  });

  it('returns an empty list when spots is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(fetchCreatorSpots(userId)).resolves.toEqual([]);
  });

  it('throws when the spots request fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: '' }, 500));
    await expect(fetchCreatorSpots(userId)).rejects.toThrow(
      'Couldn’t load those spots right now.'
    );
  });
});
