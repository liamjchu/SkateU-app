import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';

type SpotCoords = {
  latitude: number;
  longitude: number;
};

export function getSpotDirectionsUrl(spot: SpotCoords): string {
  const destination = `${spot.latitude},${spot.longitude}`;
  if (Platform.OS === 'ios') {
    return `https://maps.apple.com/?daddr=${destination}&dirflg=w`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}

export async function openSpotDirections(spot: SpotCoords): Promise<void> {
  try {
    await Linking.openURL(getSpotDirectionsUrl(spot));
  } catch {
    Alert.alert('Couldn’t open that link', 'Please try again.');
  }
}
