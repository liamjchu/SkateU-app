import {
  XP_PER_APPROVED_SPOT,
  XP_PER_COMMENT_RECEIVED,
  XP_PER_LIKE_RECEIVED,
  XP_RANK_LABELS,
  avatarOuterSize,
  clampXp,
  formatXpEventLine,
  formatXpGainToast,
  nextRank,
  parseXpEventReason,
  parseXpRank,
  rankFromXp,
  rankProgress,
  xpToNextRank,
} from '../xpRank';

describe('xpRank', () => {
  it('maps live totals onto the published rank bands', () => {
    expect(rankFromXp(0)).toBe('hobbyist');
    expect(rankFromXp(99)).toBe('hobbyist');
    expect(rankFromXp(100)).toBe('shop_rider');
    expect(rankFromXp(499)).toBe('shop_rider');
    expect(rankFromXp(500)).toBe('flow_rider');
    expect(rankFromXp(1499)).toBe('flow_rider');
    expect(rankFromXp(1500)).toBe('amateur');
    expect(rankFromXp(4999)).toBe('amateur');
    expect(rankFromXp(5000)).toBe('pro');
    expect(rankFromXp(12_000)).toBe('pro');
  });

  it('treats invalid XP as Hobbyist zero', () => {
    expect(clampXp(-4)).toBe(0);
    expect(clampXp(Number.NaN)).toBe(0);
    expect(clampXp(10.9)).toBe(10);
    expect(rankFromXp(-20)).toBe('hobbyist');
  });

  it('exposes labels, next-rank remaining XP, and in-band progress', () => {
    expect(XP_RANK_LABELS.shop_rider).toBe('Shop Rider');
    expect(nextRank('hobbyist')).toBe('shop_rider');
    expect(nextRank('pro')).toBeNull();
    expect(xpToNextRank(42)).toEqual({ next: 'shop_rider', remaining: 58 });
    expect(xpToNextRank(5000)).toBeNull();
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress(50)).toBe(0.5);
    expect(rankProgress(100)).toBe(0);
    expect(rankProgress(5000)).toBe(1);
  });

  it('parses ranks and event reasons from API values', () => {
    expect(parseXpRank('amateur')).toBe('amateur');
    expect(parseXpRank('wizard')).toBeNull();
    expect(parseXpEventReason('like_received')).toBe('like_received');
    expect(parseXpEventReason('follow_received')).toBeNull();
  });

  it('formats history lines and gain toasts', () => {
    expect(
      formatXpEventLine({
        delta: 10,
        reason: 'spot_approved',
        spotName: 'Library Ledge',
      })
    ).toBe('+10 · Approved “Library Ledge”');
    expect(
      formatXpEventLine({
        delta: -5,
        reason: 'like_removed',
        spotName: 'Rail',
      })
    ).toBe('-5 · Like removed on “Rail”');
    expect(formatXpGainToast(5, 'like_received')).toEqual({
      title: '+5 XP',
      message: 'New like',
    });
    expect(formatXpGainToast(16, null)).toEqual({
      title: '+16 XP',
      message: 'Your spots earned more XP.',
    });
  });

  it('documents the live XP weights excluding own likes and comments', () => {
    expect(XP_PER_APPROVED_SPOT).toBe(10);
    expect(XP_PER_LIKE_RECEIVED).toBe(5);
    expect(XP_PER_COMMENT_RECEIVED).toBe(1);
    expect(avatarOuterSize(16)).toBeGreaterThan(16);
  });
});
