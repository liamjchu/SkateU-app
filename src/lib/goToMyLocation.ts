import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

import type { UserLocationStatus } from '../hooks/useUserLocation';

type GoToMyLocationOptions = {
  status: UserLocationStatus;
  hasCoords: boolean;
  requestPermission: () => Promise<boolean>;
  onGoToLocation: () => void;
};

function showSettingsAlert(title: string, message: string): void {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Open Settings',
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

export async function goToMyLocation({
  status,
  hasCoords,
  requestPermission,
  onGoToLocation,
}: GoToMyLocationOptions): Promise<void> {
  if (hasCoords) {
    onGoToLocation();
    return;
  }

  if (status === 'unavailable') {
    showSettingsAlert(
      'Location is off',
      'Turn on Location Services to see where you are on the map.'
    );
    return;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) {
    return;
  }

  if (permission.canAskAgain) {
    const granted = await requestPermission();
    if (!granted) {
      return;
    }
    return;
  }

  showSettingsAlert(
    'Location permission needed',
    'Allow location access in Settings to show where you are on the map.'
  );
}
