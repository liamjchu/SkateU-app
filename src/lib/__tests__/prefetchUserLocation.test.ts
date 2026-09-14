import { prefetchUserLocation } from '../prefetchUserLocation';
import { getExpoLocation } from '../expoLocation';
import { useLocationStore } from '../../store/locationStore';

jest.mock('../expoLocation', () => ({
  getExpoLocation: jest.fn(),
}));

const getExpoLocationMock = getExpoLocation as jest.MockedFunction<
  typeof getExpoLocation
>;

describe('prefetchUserLocation', () => {
  const hasServicesEnabledAsync = jest.fn();
  const getForegroundPermissionsAsync = jest.fn();
  const getLastKnownPositionAsync = jest.fn();
  const getCurrentPositionAsync = jest.fn();

  beforeEach(() => {
    hasServicesEnabledAsync.mockReset();
    getForegroundPermissionsAsync.mockReset();
    getLastKnownPositionAsync.mockReset();
    getCurrentPositionAsync.mockReset();
    useLocationStore.setState({
      coords: null,
      status: 'idle',
      updatedAt: null,
    });
    getExpoLocationMock.mockReturnValue({
      Accuracy: { Balanced: 3 },
      hasServicesEnabledAsync,
      getForegroundPermissionsAsync,
      getLastKnownPositionAsync,
      getCurrentPositionAsync,
    } as unknown as ReturnType<typeof getExpoLocation>);
  });

  it('writes last-known coordinates without prompting', async () => {
    hasServicesEnabledAsync.mockResolvedValue(true);
    getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 41.82, longitude: -71.41, accuracy: 15 },
    });
    getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 41.83, longitude: -71.4, accuracy: 6 },
    });

    await prefetchUserLocation();

    expect(getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(useLocationStore.getState().status).toBe('ready');
    expect(useLocationStore.getState().coords).toEqual({
      latitude: 41.83,
      longitude: -71.4,
      accuracy: 6,
    });
  });

  it('marks denied when permission is not granted', async () => {
    hasServicesEnabledAsync.mockResolvedValue(true);
    getForegroundPermissionsAsync.mockResolvedValue({ granted: false });

    await prefetchUserLocation();

    expect(getLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(useLocationStore.getState().status).toBe('denied');
    expect(useLocationStore.getState().coords).toBeNull();
  });
});
