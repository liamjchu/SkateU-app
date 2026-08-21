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
});
