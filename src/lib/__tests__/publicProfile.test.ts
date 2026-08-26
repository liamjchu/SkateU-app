import {
  mapFollowListUsers,
  mapFollowStats,
  mapPublicProfileView,
} from '../publicProfile';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

  it('rejects a payload without a profile id', () => {
    expect(mapPublicProfileView({ profile: { username: 'jane' } })).toBeNull();
  });
});

describe('mapFollowStats', () => {
  it('overlays counts onto the current profile', () => {
    const current = {
      id: userId,
      username: 'skater_jane',
      avatarUrl: null,
      bio: null,
      followerCount: 1,
      followingCount: 2,
      isFollowing: false,
    };

    expect(
      mapFollowStats(
        { followerCount: 4, followingCount: 2, isFollowing: true },
        current
      )
    ).toEqual({
      ...current,
      followerCount: 4,
      isFollowing: true,
    });
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

  it('rejects a payload with an invalid user', () => {
    expect(mapFollowListUsers({ users: [{ username: 'jane' }] })).toBeNull();
  });
});
