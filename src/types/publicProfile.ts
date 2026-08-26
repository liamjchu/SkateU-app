export type PublicProfileView = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export type FollowListUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
};
