import {
  FEED_SEEN_CAP,
  isFeedSessionAppend,
  excludeSeenSpots,
  parseSeenSpotIds,
  rememberSeenSpotIds,
  syncFeedSessionSpots,
  unseenSpotCount,
} from '../feedSeen';

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

describe('syncFeedSessionSpots', () => {
  it('starts a new session with only unseen spots when the list is replaced', () => {
    expect(
      syncFeedSessionSpots(
        [{ id: 'old' }],
        [{ id: 'a' }, { id: 'b' }],
        ['a']
      ).map((spot) => spot.id)
    ).toEqual(['b']);
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
