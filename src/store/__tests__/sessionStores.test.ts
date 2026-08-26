jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useAgeEligibilityStore } from '../ageEligibilityStore';
import { useMapViewStore } from '../mapViewStore';
import { useSchools } from '../schoolsStore';

const schoolA = {
  id: 'school-a',
  name: 'Campus A',
  lat: 40,
  lng: -74,
  city: 'New York',
  state: 'NY',
  numSpots: 2,
};

const schoolAUpdated = { ...schoolA, numSpots: 9 };

describe('ageEligibilityStore', () => {
  beforeEach(() => {
    useAgeEligibilityStore.getState().clear();
  });

  it('records a 13+ confirmation for the current session only', () => {
    expect(useAgeEligibilityStore.getState().confirmedThisSession).toBe(false);
    useAgeEligibilityStore.getState().markEligible();
    expect(useAgeEligibilityStore.getState().confirmedThisSession).toBe(true);
    useAgeEligibilityStore.getState().clear();
    expect(useAgeEligibilityStore.getState().confirmedThisSession).toBe(false);
  });
});

describe('mapViewStore', () => {
  it('toggles the map layer', () => {
    useMapViewStore.setState({ mapLayer: 'default' });
    useMapViewStore.getState().setMapLayer('satellite');
    expect(useMapViewStore.getState().mapLayer).toBe('satellite');
  });
});

describe('schoolsStore', () => {
  it('upserts by id instead of duplicating', () => {
    useSchools.setState({ schools: [] });
    useSchools.getState().upsertSchool(schoolA);
    useSchools.getState().upsertSchool(schoolAUpdated);
    expect(useSchools.getState().schools).toEqual([schoolAUpdated]);
  });

  it('keeps popular schools with the filter they were fetched for', () => {
    useSchools.setState({ schools: [], popularSchools: [], popularFilter: null });
    useSchools.getState().setPopularFeed('college', [schoolA]);
    expect(useSchools.getState().popularFilter).toBe('college');
    expect(useSchools.getState().popularSchools).toEqual([schoolA]);
    expect(useSchools.getState().schools).toEqual([schoolA]);
  });

  it('merges a persisted catalog and popular rail', () => {
    const merge = useSchools.persist.getOptions().merge;
    expect(merge).toBeDefined();
    const merged = merge!(
      {
        schools: [schoolA],
        popularSchools: [schoolAUpdated],
        popularFilter: 'k12',
      },
      useSchools.getState()
    );
    expect(merged.schools).toEqual([schoolA]);
    expect(merged.popularSchools).toEqual([schoolAUpdated]);
    expect(merged.popularFilter).toBe('k12');
    expect(merge!(null, useSchools.getState()).schools).toEqual([]);
    useSchools.getState().setHasHydrated(true);
    expect(useSchools.getState().hasHydrated).toBe(true);
    useSchools.persist.getOptions().onRehydrateStorage?.(useSchools.getState())?.();
  });
});
