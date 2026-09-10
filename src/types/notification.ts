import type { XpRank } from './xp';

export const NOTIFICATION_TYPES = [
  'spot_like',
  'spot_comment',
  'comment_reply',
  'follow',
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
  spotImageUrl: string | null;
};
