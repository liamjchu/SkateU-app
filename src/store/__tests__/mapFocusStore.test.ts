import { useMapFocusStore } from '../mapFocusStore';
import type { School } from '../../types/school';

const school: School = {
  id: 'brown',
  name: 'Brown',
  lat: 41.8268,
  lng: -71.401,
  city: 'Providence',
  state: 'RI',
  numSpots: 12,
};

describe('mapFocusStore', () => {
  beforeEach(() => {
    useMapFocusStore.getState().reset();
  });

  it('keeps the camera when a campus chip is dismissed', () => {
    useMapFocusStore.getState().setSchoolFocus(school);
    const generation = useMapFocusStore.getState().cameraGeneration;
    useMapFocusStore.getState().dismissSchool();
    expect(useMapFocusStore.getState().school).toBeNull();
    expect(useMapFocusStore.getState().latitude).toBe(school.lat);
    expect(useMapFocusStore.getState().longitude).toBe(school.lng);
    expect(useMapFocusStore.getState().cameraGeneration).toBe(generation);
    expect(useMapFocusStore.getState().hasUserChosenFocus).toBe(true);
  });

  it('applies school route params once a campus is named', () => {
    useMapFocusStore.getState().applyRouteParams(
      {
        schoolId: 'brown',
        schoolName: 'Brown',
        lat: '41.82',
        lng: '-71.4',
      },
      [school]
    );
    expect(useMapFocusStore.getState().school?.id).toBe('brown');
    expect(useMapFocusStore.getState().hasUserChosenFocus).toBe(true);
  });

  it('ignores empty route params so a dismissed campus stays dismissed', () => {
    useMapFocusStore.getState().setSchoolFocus(school);
    useMapFocusStore.getState().dismissSchool();
    useMapFocusStore.getState().applyRouteParams({ lat: '1', lng: '2' }, []);
    expect(useMapFocusStore.getState().school).toBeNull();
    expect(useMapFocusStore.getState().latitude).toBe(school.lat);
  });
});
