import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { goToMyLocation } from '../goToMyLocation';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
}));

const getForegroundPermissionsAsync =
  Location.getForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.getForegroundPermissionsAsync
  >;

describe('goToMyLocation', () => {
  const requestPermission = jest.fn();
  const onGoToLocation = jest.fn();

  beforeEach(() => {
    requestPermission.mockReset();
    onGoToLocation.mockReset();
    getForegroundPermissionsAsync.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('centers the map when coordinates are already available', async () => {
    await goToMyLocation({
      status: 'ready',
      hasCoords: true,
      requestPermission,
      onGoToLocation,
    });

    expect(onGoToLocation).toHaveBeenCalledTimes(1);
    expect(getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks the user to enable Location Services when they are off', async () => {
    await goToMyLocation({
      status: 'unavailable',
      hasCoords: false,
      requestPermission,
      onGoToLocation,
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Location is off',
      'Turn on Location Services to see where you are on the map.',
      expect.any(Array)
    );
    const buttons = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    buttons.find((button) => button.text === 'Open Settings')?.onPress?.();
    expect(Linking.openSettings).toHaveBeenCalled();
    expect(onGoToLocation).not.toHaveBeenCalled();
  });

  it('does nothing when permission is already granted but coords are missing', async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);

    await goToMyLocation({
      status: 'denied',
      hasCoords: false,
      requestPermission,
      onGoToLocation,
    });

    expect(requestPermission).not.toHaveBeenCalled();
    expect(onGoToLocation).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests permission when the system will ask again', async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);
    requestPermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await goToMyLocation({
      status: 'denied',
      hasCoords: false,
      requestPermission,
      onGoToLocation,
    });
    await goToMyLocation({
      status: 'denied',
      hasCoords: false,
      requestPermission,
      onGoToLocation,
    });

    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('opens Settings when permission cannot be requested again', async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);

    await goToMyLocation({
      status: 'denied',
      hasCoords: false,
      requestPermission,
      onGoToLocation,
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Location permission needed',
      'Allow location access in Settings to show where you are on the map.',
      expect.any(Array)
    );
  });
});
