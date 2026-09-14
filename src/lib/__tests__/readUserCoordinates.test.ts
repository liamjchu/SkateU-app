import { LAST_KNOWN_MAX_AGE_MS, readUserCoordinates } from '../readUserCoordinates';
import { getExpoLocation } from '../expoLocation';

jest.mock('../expoLocation', () => ({
  getExpoLocation: jest.fn(),
}));

const getExpoLocationMock = getExpoLocation as jest.MockedFunction<
  typeof getExpoLocation
>;

describe('readUserCoordinates', () => {
  const getLastKnownPositionAsync = jest.fn();
  const getCurrentPositionAsync = jest.fn();

  beforeEach(() => {
    getLastKnownPositionAsync.mockReset();
    getCurrentPositionAsync.mockReset();
    getExpoLocationMock.mockReturnValue({
      Accuracy: { Balanced: 3 },
      getLastKnownPositionAsync,
      getCurrentPositionAsync,
    } as unknown as ReturnType<typeof getExpoLocation>);
  });

  it('prefers a recent last-known fix over a fresh GPS read', async () => {
    getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 41.82, longitude: -71.41, accuracy: 12 },
    });

    await expect(readUserCoordinates()).resolves.toEqual({
      latitude: 41.82,
      longitude: -71.41,
      accuracy: 12,
    });
    expect(getLastKnownPositionAsync).toHaveBeenCalledWith({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('falls back to the current position when last-known is missing', async () => {
    getLastKnownPositionAsync.mockResolvedValue(null);
    getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 30.27, longitude: -97.74, accuracy: 8 },
    });

    await expect(readUserCoordinates()).resolves.toEqual({
      latitude: 30.27,
      longitude: -97.74,
      accuracy: 8,
    });
  });

  it('skips a last-known null-island fix and uses the current position', async () => {
    getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 0, longitude: 0, accuracy: 100 },
    });
    getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 37.3349, longitude: -122.009, accuracy: 15 },
    });

    await expect(readUserCoordinates()).resolves.toEqual({
      latitude: 37.3349,
      longitude: -122.009,
      accuracy: 15,
    });
    expect(getCurrentPositionAsync).toHaveBeenCalled();
  });

  it('returns null when the location module is unavailable', async () => {
    getExpoLocationMock.mockReturnValue(null);

    await expect(readUserCoordinates()).resolves.toBeNull();
  });
});
