import { getExpoLocation } from './expoLocation';
import { isUsableGpsOrigin } from './nearbySchools';
import type { UserLocationCoords } from '../store/locationStore';

// A fix from the last few minutes is close enough to center the map or
// rank nearby schools, and it avoids waiting on a fresh GPS lock.
export const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

function toCoords(position: {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
}): UserLocationCoords {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
  };
}

export async function readLastKnownUserCoordinates(): Promise<UserLocationCoords | null> {
  const Location = getExpoLocation();
  if (!Location) {
    return null;
  }

  try {
    const position = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });
    return position ? toCoords(position) : null;
  } catch {
    return null;
  }
}

export async function readCurrentUserCoordinates(): Promise<UserLocationCoords | null> {
  const Location = getExpoLocation();
  if (!Location) {
    return null;
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return position ? toCoords(position) : null;
  } catch {
    return null;
  }
}

export async function readUserCoordinates(): Promise<UserLocationCoords | null> {
  const lastKnown = await readLastKnownUserCoordinates();
  if (isUsableGpsOrigin(lastKnown)) {
    return lastKnown;
  }

  const current = await readCurrentUserCoordinates();
  if (isUsableGpsOrigin(current)) {
    return current;
  }

  return current ?? lastKnown;
}
