export const XP_RANKS = [
  'hobbyist',
  'shop_rider',
  'flow_rider',
  'amateur',
  'pro',
] as const;

export type XpRank = (typeof XP_RANKS)[number];

export const XP_EVENT_REASONS = [
  'spot_approved',
  'spot_unapproved',
  'like_received',
  'like_removed',
  'comment_received',
  'comment_removed',
] as const;

export type XpEventReason = (typeof XP_EVENT_REASONS)[number];

export type XpEventView = {
  id: string;
  delta: number;
  reason: XpEventReason;
  spotId: string | null;
  spotName: string | null;
  createdAt: string;
  summary: string;
};
