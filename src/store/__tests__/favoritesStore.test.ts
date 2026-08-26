jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useFavorites } from '../favoritesStore';

const school = {
  id: 'school-1',
  name: 'Skate U',
  lat: 40.7,
  lng: -74,
  city: 'New York',
  state: 'NY',
  numSpots: 3,
};

beforeEach(() => {
  useFavorites.setState({
    favoriteSchoolIds: [],
    favoriteSchools: [],
    hasHydrated: false,
  });
});

describe('favoritesStore', () => {
  it('adds, toggles, and removes a saved school', () => {
    useFavorites.getState().addFavoriteSchool(school);
    expect(useFavorites.getState().isFavoriteSchool(school.id)).toBe(true);
    expect(useFavorites.getState().favoriteSchools).toEqual([school]);

    useFavorites.getState().addFavoriteSchool(school);
    expect(useFavorites.getState().favoriteSchoolIds).toEqual([school.id]);

    useFavorites.getState().upsertFavoriteSchool({ ...school, numSpots: 12 });
    expect(useFavorites.getState().favoriteSchools[0]?.numSpots).toBe(12);

    useFavorites.getState().toggleFavoriteSchool(school);
    expect(useFavorites.getState().isFavoriteSchool(school.id)).toBe(false);

    useFavorites.getState().toggleFavoriteSchool(school);
    expect(useFavorites.getState().isFavoriteSchool(school.id)).toBe(true);

    useFavorites.getState().removeFavoriteSchool(school.id);
    expect(useFavorites.getState().favoriteSchools).toEqual([]);
  });

  it('does not upsert a school that is not saved', () => {
    useFavorites.getState().upsertFavoriteSchool(school);
    expect(useFavorites.getState().favoriteSchools).toEqual([]);
  });

  it('marks hydration complete', () => {
    useFavorites.getState().setHasHydrated(true);
    expect(useFavorites.getState().hasHydrated).toBe(true);
  });

  it('merges persisted favorites and drops schools that are no longer saved', () => {
    const merge = useFavorites.persist.getOptions().merge;
    expect(merge).toBeDefined();
    const current = useFavorites.getState();
    const merged = merge!(
      {
        favoriteSchoolIds: ['school-1', 2, 'school-2'],
        favoriteSchools: [
          school,
          {
            id: 'school-2',
            name: 'Other',
            lat: 1,
            lng: 2,
            city: 'Austin',
            state: 'TX',
            numSpots: 1,
          },
        ],
      },
      current
    );

    expect(merged.favoriteSchoolIds).toEqual(['school-1', 'school-2']);
    expect(merged.favoriteSchools.map((item) => item.id)).toEqual([
      'school-1',
      'school-2',
    ]);

    expect(merge!(null, current).favoriteSchoolIds).toEqual([]);
    expect(merge!({ favoriteSchoolIds: 'nope' }, current).favoriteSchools).toEqual(
      []
    );
  });

  it('runs the hydration listener', () => {
    const onRehydrate = useFavorites.persist.getOptions().onRehydrateStorage;
    onRehydrate?.(useFavorites.getState())?.();
    expect(useFavorites.getState().hasHydrated).toBe(true);
  });
});
