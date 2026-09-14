import {
  FEED_SEEN_CAP,
  extendFeedSession,
  isFeedSessionAppend,
  excludeSeenSpots,
  parseSeenSpotIds,
  recycleFeedSpots,
  rememberSeenSpotIds,
  shuffleFeedSpots,
  startFeedSession,
  syncFeedSessionSpots,
  unseenSpotCount,
} from '../feedSeen';

function idsOf<T extends { id: string }>(spots: T[]): string[] {
  return spots.map((spot) => spot.id);
}

function sortedIds(ids: string[]): string[] {
  return [...ids].sort();
}

describe('rememberSeenSpotIds', () => {
  it('appends new ids and moves repeats to the end', () => {
    expect(rememberSeenSpotIds(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(rememberSeenSpotIds(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });

  it('drops the oldest ids past the cap', () => {
    const ids = Array.from({ length: FEED_SEEN_CAP }, (_, index) =>
      String(index)
    );
    expect(rememberSeenSpotIds(ids, 'new')).toHaveLength(FEED_SEEN_CAP);
    expect(rememberSeenSpotIds(ids, 'new')[0]).toBe('1');
    expect(rememberSeenSpotIds(ids, 'new').at(-1)).toBe('new');
  });
});

describe('parseSeenSpotIds', () => {
  it('keeps unique string ids up to the cap', () => {
    expect(parseSeenSpotIds(['a', '', 'a', 1, 'b'])).toEqual(['a', 'b']);
    expect(parseSeenSpotIds(null)).toEqual([]);
  });
});

describe('excludeSeenSpots', () => {
  const spots = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('drops spots the user has already viewed', () => {
    expect(excludeSeenSpots(spots, ['b']).map((spot) => spot.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('returns an empty list when every spot was seen', () => {
    expect(excludeSeenSpots(spots, ['a', 'b', 'c'])).toEqual([]);
  });

  it('keeps the incoming order when nothing was seen', () => {
    expect(excludeSeenSpots(spots, [])).toEqual(spots);
  });
});

describe('startFeedSession', () => {
  const spots = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('opens on the last viewed spot, then remaining unseen spots', () => {
    expect(startFeedSession(spots, ['a', 'c']).map((spot) => spot.id)).toEqual([
      'c',
      'b',
    ]);
  });

  it('continues through remaining unique spots when everything loaded so far was seen', () => {
    expect(
      startFeedSession(spots, ['a', 'b', 'c']).map((spot) => spot.id)
    ).toEqual(['c', 'a', 'b']);
  });

  it('keeps ranking order when nothing has been viewed', () => {
    expect(startFeedSession(spots, []).map((spot) => spot.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('shuffleFeedSpots', () => {
  const spots = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('returns a permutation without mutating the input', () => {
    const original = [...spots];
    const shuffled = shuffleFeedSpots(spots, 7);
    expect(sortedIds(idsOf(shuffled))).toEqual(sortedIds(idsOf(spots)));
    expect(spots).toEqual(original);
  });

  it('changes order for a non-trivial seed', () => {
    expect(idsOf(shuffleFeedSpots(spots, 11))).not.toEqual(idsOf(spots));
  });
});

describe('recycleFeedSpots', () => {
  const spots = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('does not recycle until every unique pool spot is already queued', () => {
    expect(recycleFeedSpots([{ id: 'a' }, { id: 'b' }], spots, 1)).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('queues a shuffled extra cycle before the last unique spots run out', () => {
    const session = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = recycleFeedSpots(session, spots, 1);
    expect(idsOf(next).slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(next).toHaveLength(6);
    expect(sortedIds(idsOf(next).slice(3))).toEqual(['a', 'b', 'c']);
    expect(next[3].id).not.toBe('c');
  });

  it('does not recycle while a full extra cycle is already queued', () => {
    const pool = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
      { id: 'e' },
      { id: 'f' },
    ];
    const session = [...pool, ...pool];
    expect(recycleFeedSpots(session, pool, 0)).toBe(session);
  });
});

describe('extendFeedSession', () => {
  it('appends unseen spots that are not already in the session', () => {
    const pool = [{ id: 'a' }, { id: 'b' }];
    const next = extendFeedSession([{ id: 'a' }], pool, [], false);
    expect(next[0].id).toBe('a');
    expect(next[1].id).toBe('b');
    expect(next.length).toBeGreaterThan(pool.length);
    expect(sortedIds(idsOf(next).slice(0, 2))).toEqual(['a', 'b']);
  });

  it('recycles the pool when there is nothing new to load', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = extendFeedSession(pool, pool, ['a', 'b', 'c'], false, 2);
    expect(idsOf(next).slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(next).toHaveLength(6);
    expect(sortedIds(idsOf(next).slice(3))).toEqual(['a', 'b', 'c']);
  });

  it('appends already-loaded seen spots before recycling once paging is done', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = extendFeedSession([{ id: 'b' }], pool, ['a', 'b', 'c'], false);
    expect(idsOf(next).slice(0, 3)).toEqual(['b', 'a', 'c']);
    expect(next.length).toBeGreaterThan(3);
  });

  it('queues remaining unique spots without looping while another page could still load', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const next = extendFeedSession([{ id: 'b' }], pool, ['a', 'b', 'c'], true);
    expect(idsOf(next)).toEqual(['b', 'a', 'c']);
    expect(next).toHaveLength(3);
  });

  it('does not recycle while another page could still load', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(extendFeedSession(pool, pool, ['a', 'b', 'c'], true, 2)).toEqual(
      pool
    );
  });
});

describe('syncFeedSessionSpots', () => {
  it('keeps the current session when the incoming list is replaced', () => {
    expect(
      syncFeedSessionSpots(
        [{ id: 'old' }],
        [{ id: 'a' }, { id: 'b' }],
        ['a']
      ).map((spot) => spot.id)
    ).toEqual(['old', 'b']);
  });

  it('starts from the last viewed spot when the session is empty', () => {
    expect(
      syncFeedSessionSpots([], [{ id: 'a' }, { id: 'b' }], ['a']).map(
        (spot) => spot.id
      )
    ).toEqual(['a', 'b']);
  });

  it('appends newly loaded unseen spots without reshuffling the current session', () => {
    expect(
      syncFeedSessionSpots(
        [{ id: 'a' }, { id: 'b' }],
        [{ id: 'x' }, { id: 'a' }, { id: 'b' }, { id: 'c' }],
        ['c']
      ).map((spot) => spot.id)
    ).toEqual(['a', 'b', 'x']);
  });

  it('keeps spots already in the session after they are marked seen', () => {
    expect(
      syncFeedSessionSpots(
        [{ id: 'a' }],
        [{ id: 'a' }, { id: 'b' }],
        ['a']
      ).map((spot) => spot.id)
    ).toEqual(['a', 'b']);
  });

  it('refreshes session spot objects when the incoming list updates', () => {
    const next = syncFeedSessionSpots(
      [{ id: 'a', likes: 1 }],
      [{ id: 'a', likes: 4 }],
      []
    );
    expect(next).toEqual([{ id: 'a', likes: 4 }]);
  });

  it('detects append vs replace', () => {
    expect(
      isFeedSessionAppend([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])
    ).toBe(true);
    expect(isFeedSessionAppend([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }])).toBe(
      false
    );
  });
});

describe('unseenSpotCount', () => {
  it('counts spots missing from the seen list', () => {
    expect(unseenSpotCount([{ id: 'a' }, { id: 'b' }], ['a'])).toBe(1);
  });
});
