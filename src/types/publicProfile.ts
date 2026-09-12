import type { XpRank } from './xp';

export type PublicProfileView = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  rank: XpRank;
  xpTotal?: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};

export type FollowListUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  rank: XpRank;
  isFollowing: boolean;
};
