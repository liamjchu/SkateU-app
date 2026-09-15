import { getExpoLocation } from './expoLocation';
import {
  readCurrentUserCoordinates,
  readLastKnownUserCoordinates,
} from './readUserCoordinates';
import { useLocationStore } from '../store/locationStore';

/**
 * Warms GPS into locationStore when foreground permission is already granted.
 * Does not prompt.
 */
export async function prefetchUserLocation(
  isCancelled: () => boolean = () => false
): Promise<void> {
  const Location = getExpoLocation();
  if (!Location) {
    useLocationStore.getState().setStatus('unavailable');
    return;
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (isCancelled()) {
    return;
  }
  if (!servicesEnabled) {
    useLocationStore.getState().setStatus('unavailable');
    return;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (isCancelled()) {
    return;
  }
  if (!permission.granted) {
    if (useLocationStore.getState().status === 'idle') {
      useLocationStore.getState().setStatus('denied');
    }
    return;
  }

  if (useLocationStore.getState().status !== 'ready') {
    useLocationStore.getState().setStatus('requesting');
  }

  const lastKnown = await readLastKnownUserCoordinates();
  if (isCancelled()) {
    return;
  }
  if (lastKnown && !useLocationStore.getState().coords) {
    useLocationStore.getState().setLocation(lastKnown);
  }

  const current = await readCurrentUserCoordinates();
  if (isCancelled()) {
    return;
  }
  if (current) {
    useLocationStore.getState().setLocation(current);
    return;
  }

  if (!useLocationStore.getState().coords) {
    useLocationStore.getState().setStatus('unavailable');
  }
}
