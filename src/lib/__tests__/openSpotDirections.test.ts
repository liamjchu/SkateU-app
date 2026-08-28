import { Platform } from 'react-native';
import { getSpotDirectionsUrl, openSpotDirections } from '../openSpotDirections';

const mockOpenURL = jest.fn();
const mockAlert = jest.fn();

jest.mock('expo-linking', () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => mockAlert(...args),
  },
  Platform: {
    OS: 'ios',
  },
}));

const spot = { latitude: 41.8268, longitude: -71.4025 };

function setPlatform(os: typeof Platform.OS): void {
  Platform.OS = os;
}

beforeEach(() => {
  mockOpenURL.mockReset();
  mockAlert.mockReset();
  setPlatform('ios');
});

describe('getSpotDirectionsUrl', () => {
  it('builds an Apple Maps walking URL on iOS', () => {
    setPlatform('ios');

    expect(getSpotDirectionsUrl(spot)).toBe(
      'https://maps.apple.com/?daddr=41.8268,-71.4025&dirflg=w'
    );
  });

  it('builds a Google Maps walking URL on Android', () => {
    setPlatform('android');

    expect(getSpotDirectionsUrl(spot)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=41.8268,-71.4025&travelmode=walking'
    );
  });

  it('builds a Google Maps walking URL on web', () => {
    setPlatform('web');

    expect(getSpotDirectionsUrl(spot)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=41.8268,-71.4025&travelmode=walking'
    );
  });
});

describe('openSpotDirections', () => {
  it('opens the platform directions URL', async () => {
    setPlatform('ios');
    mockOpenURL.mockResolvedValue(true);

    await openSpotDirections(spot);

    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://maps.apple.com/?daddr=41.8268,-71.4025&dirflg=w'
    );
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('alerts when the URL cannot be opened', async () => {
    setPlatform('android');
    mockOpenURL.mockRejectedValue(new Error('unsupported'));

    await openSpotDirections(spot);

    expect(mockAlert).toHaveBeenCalledWith(
      'Couldn’t open that link',
      'Please try again.'
    );
  });
});
