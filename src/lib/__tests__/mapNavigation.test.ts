import { resetNavigationGuard } from '../navigationGuard';
import { openSchoolOnMap, openSpotOnMap } from '../mapNavigation';
import { useMapFocusStore } from '../../store/mapFocusStore';
import type { School } from '../../types/school';
import type { Spot } from '../../types/spot';

jest.mock('../analytics', () => ({
  captureAnalyticsEvent: jest.fn(),
}));

const school: School = {
  id: 'brown',
  name: 'Brown',
  lat: 41.8268,
  lng: -71.401,
  city: 'Providence',
  state: 'RI',
  numSpots: 12,
};

const spot: Spot = {
  id: 'spot-1',
  name: 'Ledge',
  description: '',
  latitude: 41.827,
  longitude: -71.402,
  imageUris: [],
  city: 'Providence',
  state: 'RI',
  schoolName: 'Brown',
  schoolId: 'brown',
  creatorUsername: null,
  creatorAvatarUrl: null,
  createdAt: '',
  updatedAt: '',
};

describe('map navigation helpers', () => {
  beforeEach(() => {
    resetNavigationGuard();
    useMapFocusStore.getState().reset();
  });

  it('stores the campus and switches to the map tab', () => {
    const router = { navigate: jest.fn() };
    openSchoolOnMap(router as never, school);
    expect(useMapFocusStore.getState().school?.id).toBe('brown');
    expect(useMapFocusStore.getState().hasUserChosenFocus).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/map',
      params: expect.objectContaining({ schoolId: 'brown' }),
    });
  });

  it('stores the spot and refuses spots with no campus', () => {
    const router = { navigate: jest.fn() };
    expect(openSpotOnMap(router as never, { ...spot, schoolId: undefined })).toBe(
      false
    );
    expect(router.navigate).not.toHaveBeenCalled();

    expect(openSpotOnMap(router as never, spot)).toBe(true);
    expect(useMapFocusStore.getState().spotId).toBe('spot-1');
    expect(useMapFocusStore.getState().latitude).toBe(spot.latitude);
  });
});
