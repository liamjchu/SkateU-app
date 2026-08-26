import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type UserLocationStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unavailable';

export type UserLocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type UseUserLocationResult = {
  coords: UserLocationCoords | null;
  status: UserLocationStatus;
  requestPermission: () => Promise<boolean>;
};

export function useUserLocation(enabled: boolean): UseUserLocationResult {
  const [status, setStatus] = useState<UserLocationStatus>('idle');
  const [coords, setCoords] = useState<UserLocationCoords | null>(null);
  const [watchKey, setWatchKey] = useState(0);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setStatus('unavailable');
      return false;
    }

    setStatus('requesting');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setStatus('denied');
      return false;
    }

    setWatchKey((key) => key + 1);
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

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
        setStatus('requesting');
        permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (!permission.granted) {
          setStatus('denied');
          return;
        }
      }

      setStatus('requesting');
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
            setCoords({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
            setStatus('ready');
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
  }, [enabled, watchKey]);

  return { coords, status, requestPermission };
}
