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
});
