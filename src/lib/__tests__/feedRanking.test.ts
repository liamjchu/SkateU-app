import {
  FEED_RECENCY_HALF_LIFE_HOURS,
  rankFeedSpots,
  scoreFeedSpot,
  sliceRankedFeedPage,
  type FeedRankableSpot,
} from '../feedRanking';

function spot(
  overrides: Partial<FeedRankableSpot> & Pick<FeedRankableSpot, 'id'>
): FeedRankableSpot {
  return {
    created_at: '2026-09-11T12:00:00.000Z',
    likes_count: 0,
    comments_count: 0,
    ...overrides,
  };
}

describe('scoreFeedSpot', () => {
  const now = Date.parse('2026-09-11T12:00:00.000Z');

  it('scores a fresh unused spot from recency alone', () => {
    expect(scoreFeedSpot(spot({ id: 'fresh' }), now)).toBe(8);
  });

  it('lets recent engagement beat a brand-new quiet spot', () => {
    const quiet = scoreFeedSpot(spot({ id: 'quiet' }), now);
    const hot = scoreFeedSpot(
      spot({
        id: 'hot',
        created_at: '2026-09-11T10:00:00.000Z',
        likes_count: 40,
        comments_count: 10,
      }),
      now
    );
    expect(hot).toBeGreaterThan(quiet);
  });

  it('lets a fresh spot beat a week-old popular one', () => {
    const fresh = scoreFeedSpot(spot({ id: 'fresh' }), now);
    const stale = scoreFeedSpot(
      spot({
        id: 'stale',
        created_at: '2026-09-01T12:00:00.000Z',
        likes_count: 200,
        comments_count: 40,
      }),
      now
    );
    expect(fresh).toBeGreaterThan(stale);
  });

  it('halves recency after one half-life', () => {
    const aged = spot({
      id: 'aged',
      created_at: new Date(
        now - FEED_RECENCY_HALF_LIFE_HOURS * 60 * 60 * 1000
      ).toISOString(),
    });
    expect(scoreFeedSpot(aged, now)).toBeCloseTo(4, 5);
  });
});

describe('rankFeedSpots', () => {
  const now = Date.parse('2026-09-11T12:00:00.000Z');

  it('orders by score then newer created_at then id', () => {
    const ranked = rankFeedSpots(
      [
        spot({ id: 'b', likes_count: 2 }),
        spot({ id: 'a', likes_count: 2 }),
        spot({
          id: 'hot',
          likes_count: 12,
          created_at: '2026-09-11T11:00:00.000Z',
        }),
      ],
      now
    );
    expect(ranked.map((item) => item.id)).toEqual(['hot', 'b', 'a']);
  });
});

describe('sliceRankedFeedPage', () => {
  it('pages the ranked list without mutating it', () => {
    const spots = [spot({ id: '1' }), spot({ id: '2' }), spot({ id: '3' })];
    expect(sliceRankedFeedPage(spots, 1, 1).map((item) => item.id)).toEqual([
      '2',
    ]);
    expect(spots).toHaveLength(3);
  });
});
