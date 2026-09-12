import type { XpRank } from './xp';

export const NOTIFICATION_TYPES = [
  'spot_like',
  'spot_comment',
  'comment_reply',
  'follow',
  'saved_school_spot',
  'liked_spot_comment',
  'spot_approved',
  'spot_uploaded',
  'spot_under_review',
  'spot_removed',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type UserNotification = {
  id: string;
  type: NotificationType;
  body: string;
  createdAt: string;
  readAt: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  actorRank?: XpRank;
  spotId: string | null;
  spotName: string | null;
  schoolName: string | null;
  spotImageUrl: string | null;
};
