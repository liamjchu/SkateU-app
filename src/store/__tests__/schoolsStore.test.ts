jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { NEARBY_SCHOOLS_LIMIT } from '../../lib/nearbySchools';
import { SCHOOLS_CACHE_CAP } from '../../lib/readCache';
import type { School } from '../../types/school';
import { useSchools } from '../schoolsStore';

const AUSTIN = { latitude: 30.2672, longitude: -97.7431 };

function makeSchool(id: string, numSpots = 0): School {
  return {
    id,
    name: `School ${id}`,
    lat: 30.3,
    lng: -97.8,
    city: 'Austin',
    state: 'TX',
    numSpots,
  };
}

beforeEach(() => {
  useSchools.setState({
    schools: [],
    popularSchools: [],
    popularFilter: null,
    nearbySchools: [],
    nearbyFilter: null,
    nearbyOrigin: null,
    hasHydrated: false,
  });
});

describe('schoolsStore nearby feed', () => {
  it('stores the feed with its filter and origin', () => {
    const schools = [makeSchool('a'), makeSchool('b')];

    useSchools.getState().setNearbyFeed('college', AUSTIN, schools);

    const state = useSchools.getState();
    expect(state.nearbySchools).toEqual(schools);
    expect(state.nearbyFilter).toBe('college');
    expect(state.nearbyOrigin).toEqual(AUSTIN);
  });

  it('merges nearby schools into the catalog without duplicating entries', () => {
    useSchools.getState().upsertSchool(makeSchool('a', 1));
    useSchools.getState().upsertSchool(makeSchool('z', 2));

    useSchools
      .getState()
      .setNearbyFeed('all', AUSTIN, [makeSchool('a', 9), makeSchool('b', 3)]);

    const catalog = useSchools.getState().schools;
    expect(catalog.map((school) => school.id)).toEqual(['a', 'b', 'z']);
    // The fresh copy from the feed wins over the stale catalog entry.
    expect(catalog[0]?.numSpots).toBe(9);
  });

  it('caps the catalog when a feed overflows it', () => {
    const schools = Array.from({ length: SCHOOLS_CACHE_CAP + 10 }, (_, index) =>
      makeSchool(`school-${index}`)
    );

    useSchools.getState().setNearbyFeed('all', AUSTIN, schools);

    expect(useSchools.getState().schools).toHaveLength(SCHOOLS_CACHE_CAP);
  });

  it('leaves the popular feed alone', () => {
    useSchools.getState().upsertSchool(makeSchool('existing'));
    useSchools.getState().setPopularFeed('all', [makeSchool('popular')]);
    useSchools.getState().setNearbyFeed('all', AUSTIN, [makeSchool('near')]);

    expect(
      useSchools.getState().popularSchools.map((school) => school.id)
    ).toEqual(['popular']);
    expect(useSchools.getState().schools.map((school) => school.id)).toEqual([
      'near',
      'popular',
      'existing',
    ]);
  });
});

describe('schoolsStore persistence', () => {
  it('caps the persisted nearby feed', () => {
    const partialize = useSchools.persist.getOptions().partialize;
    expect(partialize).toBeDefined();

    useSchools.getState().setNearbyFeed(
      'all',
      AUSTIN,
      Array.from({ length: NEARBY_SCHOOLS_LIMIT + 5 }, (_, index) =>
        makeSchool(`school-${index}`)
      )
    );

    const persisted = partialize!(useSchools.getState()) as {
      nearbySchools: School[];
      nearbyOrigin: typeof AUSTIN | null;
    };

    expect(persisted.nearbySchools).toHaveLength(NEARBY_SCHOOLS_LIMIT);
    expect(persisted.nearbyOrigin).toEqual(AUSTIN);
  });

  it('restores a persisted nearby feed', () => {
    const merge = useSchools.persist.getOptions().merge;
    expect(merge).toBeDefined();

    const merged = merge!(
      {
        nearbySchools: [makeSchool('a')],
        nearbyFilter: 'k12',
        nearbyOrigin: AUSTIN,
      },
      useSchools.getState()
    );

    expect(merged.nearbySchools.map((school) => school.id)).toEqual(['a']);
    expect(merged.nearbyFilter).toBe('k12');
    expect(merged.nearbyOrigin).toEqual(AUSTIN);
  });

  it('drops malformed persisted nearby values', () => {
    const merge = useSchools.persist.getOptions().merge;
    const current = useSchools.getState();

    expect(merge!(null, current).nearbySchools).toEqual([]);
    expect(merge!(null, current).nearbyOrigin).toBeNull();
    expect(
      merge!({ nearbySchools: 'nope', nearbyFilter: 'bogus' }, current)
        .nearbyFilter
    ).toBeNull();
    expect(
      merge!({ nearbyOrigin: { latitude: 200, longitude: 0 } }, current)
        .nearbyOrigin
    ).toBeNull();
    expect(
      merge!({ nearbyOrigin: { latitude: '30', longitude: -97 } }, current)
        .nearbyOrigin
    ).toBeNull();
  });

  it('marks hydration complete', () => {
    const onRehydrate = useSchools.persist.getOptions().onRehydrateStorage;
    onRehydrate?.(useSchools.getState())?.();
    expect(useSchools.getState().hasHydrated).toBe(true);
  });
});
