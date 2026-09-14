import { useCallback, useEffect, useState } from 'react';
import { getExpoLocation } from '../lib/expoLocation';
import {
  useLocationStore,
  type UserLocationCoords,
  type UserLocationStatus,
} from '../store/locationStore';

export type { UserLocationCoords, UserLocationStatus };

type UseUserLocationResult = {
  coords: UserLocationCoords | null;
  status: UserLocationStatus;
  requestPermission: () => Promise<boolean>;
};

type UseUserLocationOptions = {
  requestIfNeeded?: boolean;
};

export function useUserLocation(
  enabled: boolean,
  options: UseUserLocationOptions = {}
): UseUserLocationResult {
  const requestIfNeeded = options.requestIfNeeded !== false;
  const coords = useLocationStore((state) => state.coords);
  const status = useLocationStore((state) => state.status);
  const setLocation = useLocationStore((state) => state.setLocation);
  const setStatus = useLocationStore((state) => state.setStatus);
  const [watchKey, setWatchKey] = useState(0);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const Location = getExpoLocation();
    if (!Location) {
      setStatus('unavailable');
      return false;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setStatus('unavailable');
      return false;
    }

    if (!useLocationStore.getState().coords) {
      setStatus('requesting');
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setStatus('denied');
      return false;
    }

    setWatchKey((key) => key + 1);
    return true;
  }, [setStatus]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const Location = getExpoLocation();
    if (!Location) {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    const watch = async () => {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (cancelled) {
        return;
      }
      if (!servicesEnabled) {
        setStatus('unavailable');
        return;
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }

      if (!permission.granted) {
        if (!requestIfNeeded) {
          setStatus('denied');
          return;
        }

        if (!useLocationStore.getState().coords) {
          setStatus('requesting');
        }
        permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (!permission.granted) {
          setStatus('denied');
          return;
        }
      }

      if (!useLocationStore.getState().coords) {
        setStatus('requesting');
      }
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 8,
            timeInterval: 2000,
          },
          (position) => {
            if (cancelled) {
              return;
            }
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          }
        );
      } catch {
        if (!cancelled) {
          setStatus('unavailable');
        }
      }
    };

    void watch();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, requestIfNeeded, setLocation, setStatus, watchKey]);

  return { coords, status, requestPermission };
}
