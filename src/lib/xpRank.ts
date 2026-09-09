import {
  XP_EVENT_REASONS,
  XP_RANKS,
  type XpEventReason,
  type XpRank,
} from '../types/xp';

export {
  XP_EVENT_REASONS,
  XP_RANKS,
  type XpEventReason,
  type XpRank,
};

export const XP_PER_APPROVED_SPOT = 10;
export const XP_PER_LIKE_RECEIVED = 5;
export const XP_PER_COMMENT_RECEIVED = 1;

export const XP_RANK_LABELS: Record<XpRank, string> = {
  hobbyist: 'Hobbyist',
  shop_rider: 'Shop Rider',
  flow_rider: 'Flow Rider',
  amateur: 'Amateur',
  pro: 'Pro',
};

export const XP_RANK_MIN: Record<XpRank, number> = {
  hobbyist: 0,
  shop_rider: 100,
  flow_rider: 500,
  amateur: 1500,
  pro: 5000,
};

export const XP_RANK_RING_COLORS: Record<Exclude<XpRank, 'pro'>, string> = {
  hobbyist: '#8B5E3C',
  shop_rider: '#B87333',
  flow_rider: '#C0C8D0',
  amateur: '#D4A017',
};

export const XP_PRO_RING_COLORS = [
  '#E67A90',
  '#E8C547',
  '#6BCB77',
  '#4D96FF',
  '#C084FC',
] as const;

const RANK_ORDER: readonly XpRank[] = XP_RANKS;

export function clampXp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function rankFromXp(xp: number): XpRank {
  const total = clampXp(xp);
  if (total >= XP_RANK_MIN.pro) {
    return 'pro';
  }
  if (total >= XP_RANK_MIN.amateur) {
    return 'amateur';
  }
  if (total >= XP_RANK_MIN.flow_rider) {
    return 'flow_rider';
  }
  if (total >= XP_RANK_MIN.shop_rider) {
    return 'shop_rider';
  }
  return 'hobbyist';
}

export function parseXpRank(value: unknown): XpRank | null {
  if (typeof value !== 'string') {
    return null;
  }
  return RANK_ORDER.find((rank) => rank === value) ?? null;
}

export function parseXpEventReason(value: unknown): XpEventReason | null {
  if (typeof value !== 'string') {
    return null;
  }
  return XP_EVENT_REASONS.find((reason) => reason === value) ?? null;
}

export function nextRank(rank: XpRank): XpRank | null {
  const index = RANK_ORDER.indexOf(rank);
  return RANK_ORDER[index + 1] ?? null;
}

export function xpToNextRank(xp: number): { next: XpRank; remaining: number } | null {
  const rank = rankFromXp(xp);
  const upcoming = nextRank(rank);
  if (!upcoming) {
    return null;
  }
  return {
    next: upcoming,
    remaining: Math.max(0, XP_RANK_MIN[upcoming] - clampXp(xp)),
  };
}

export function rankProgress(xp: number): number {
  const total = clampXp(xp);
  const rank = rankFromXp(total);
  const upcoming = nextRank(rank);
  if (!upcoming) {
    return 1;
  }
  const start = XP_RANK_MIN[rank];
  const end = XP_RANK_MIN[upcoming];
  const span = end - start;
  if (span <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, (total - start) / span));
}

export function avatarRingWidth(size: number): number {
  if (size < 24) {
    return 1.5;
  }
  if (size < 64) {
    return 2.5;
  }
  return 4;
}

export function avatarRingGap(size: number): number {
  return size >= 64 ? 2 : 1;
}

export function avatarOuterSize(size: number): number {
  return size + (avatarRingWidth(size) + avatarRingGap(size)) * 2;
}

function quotedSpotName(spotName: string | null): string {
  const name = spotName?.trim();
  return name ? ` “${name}”` : '';
}

export function formatXpEventLine(input: {
  delta: number;
  reason: XpEventReason;
  spotName: string | null;
}): string {
  const signed = input.delta > 0 ? `+${input.delta}` : `${input.delta}`;
  const spot = quotedSpotName(input.spotName);
  switch (input.reason) {
    case 'spot_approved':
      return `${signed} · Approved${spot}`;
    case 'spot_unapproved':
      return `${signed} · Spot removed${spot}`;
    case 'like_received':
      return `${signed} · Like on${spot || ' your spot'}`;
    case 'like_removed':
      return `${signed} · Like removed${spot ? ` on${spot}` : ''}`;
    case 'comment_received':
      return `${signed} · Comment on${spot || ' your spot'}`;
    case 'comment_removed':
      return `${signed} · Comment removed${spot ? ` on${spot}` : ''}`;
  }
}

export function formatXpGainToast(
  delta: number,
  reason?: XpEventReason | null
): { title: string; message: string } {
  const amount = Math.max(0, Math.floor(delta));
  const title = `+${amount} XP`;
  if (reason === 'spot_approved') {
    return { title, message: 'Spot approved' };
  }
  if (reason === 'like_received') {
    return { title, message: 'New like' };
  }
  if (reason === 'comment_received') {
    return { title, message: 'New comment' };
  }
  return { title, message: 'Your spots earned more XP.' };
}
