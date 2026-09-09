import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { getSchoolTypesParam } from '../components/SchoolTypePills';
import { getApiUrl } from '../lib/api';
import { getExpoLocation } from '../lib/expoLocation';
import { shouldRefetchNearby, type NearbyOrigin } from '../lib/nearbySchools';
import { toUserFacingError } from '../lib/userFacingError';
import { useSchools } from '../store/schoolsStore';
import type { School, SchoolTypeFilter } from '../types/school';

// A fix from the last few minutes is close enough for a "schools near you"
// rail, and it avoids waiting on a fresh GPS lock.
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
// Shared so a filter mismatch does not hand the home feed a new array, which
// would rebuild its memoized list header on every render.
const NO_SCHOOLS: School[] = [];

export type NearbySchoolsStatus =
  // Checking permission on mount. The rail shows its loading state.
  | 'idle'
  // Not granted yet. The rail shows the opt-in card.
  | 'prompt'
  | 'loading'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'error';

type NearbySchoolsResponse = {
  schools: School[];
};

type UseNearbySchoolsResult = {
  schools: School[];
  origin: NearbyOrigin | null;
  status: NearbySchoolsStatus;
  error: string;
  enableLocation: () => Promise<void>;
  retry: () => void;
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

async function readCoordinates(): Promise<NearbyOrigin | null> {
  const Location = getExpoLocation();
  if (!Location) {
    return null;
  }

  const position =
    (await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    })) ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }));

  if (!position) {
    return null;
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

/**
 * Powers the home "Nearby schools" rail. Location is opt-in: nothing prompts
 * until enableLocation() is called, but a permission granted elsewhere (the
 * campus map) is picked up automatically.
 */
export function useNearbySchools(
  filter: SchoolTypeFilter
): UseNearbySchoolsResult {
  const nearbySchools = useSchools((state) => state.nearbySchools);
  const nearbyFilter = useSchools((state) => state.nearbyFilter);
  const nearbyOrigin = useSchools((state) => state.nearbyOrigin);
  const setNearbyFeed = useSchools((state) => state.setNearbyFeed);

  const [status, setStatus] = useState<NearbySchoolsStatus>('idle');
  const [error, setError] = useState('');
  const [loadNonce, setLoadNonce] = useState(0);
  const forceRefreshRef = useRef(false);
  // Read inside the effect without making cached results a dependency, which
  // would restart the load every time the feed is written.
  const cachedFilterRef = useRef(nearbyFilter);
  const cachedOriginRef = useRef(nearbyOrigin);
  cachedFilterRef.current = nearbyFilter;
  cachedOriginRef.current = nearbyOrigin;

  const isEnabled = filter !== 'saved';

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const force = forceRefreshRef.current;
    forceRefreshRef.current = false;

    const load = async () => {
      const Location = getExpoLocation();
      if (!Location) {
        setStatus('unavailable');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (cancelled) {
        return;
      }
      if (!servicesEnabled) {
        setStatus('unavailable');
        return;
      }

      const permission = await Location.getForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (!permission.granted) {
        setStatus('prompt');
        return;
      }

      setStatus('loading');

      try {
        const origin = await readCoordinates();
        if (cancelled) {
          return;
        }
        if (!origin) {
          setStatus('unavailable');
          return;
        }

        const isCacheFresh =
          cachedFilterRef.current === filter &&
          !shouldRefetchNearby(cachedOriginRef.current, origin);
        if (!force && isCacheFresh) {
          setError('');
          setStatus('ready');
          return;
        }

        const typeParam = getSchoolTypesParam(filter);
        const typeQuery = typeParam
          ? `&type=${encodeURIComponent(typeParam)}`
          : '';
        const response = await fetch(
          getApiUrl(
            `/api/schools?nearby=1&lat=${origin.latitude}&lng=${origin.longitude}${typeQuery}`
          ),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ??
              `Nearby schools failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as NearbySchoolsResponse;
        if (cancelled) {
          return;
        }

        setNearbyFeed(filter, origin, data.schools ?? []);
        setError('');
        setStatus('ready');
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === 'AbortError') {
          return;
        }
        if (cancelled) {
          return;
        }

        setError(
          toUserFacingError(
            loadError,
            'Couldn’t load nearby schools right now.'
          )
        );
        setStatus('error');
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filter, isEnabled, loadNonce, setNearbyFeed]);

  const enableLocation = useCallback(async () => {
    const Location = getExpoLocation();
    if (!Location) {
      setStatus('unavailable');
      showSettingsAlert(
        'Location is off',
        'Turn on Location Services to see the schools closest to you.'
      );
      return;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setStatus('unavailable');
      showSettingsAlert(
        'Location is off',
        'Turn on Location Services to see the schools closest to you.'
      );
      return;
    }

    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) {
      setLoadNonce((nonce) => nonce + 1);
      return;
    }

    if (!permission.canAskAgain) {
      setStatus('denied');
      showSettingsAlert(
        'Location permission needed',
        'Allow location access in Settings to see the schools closest to you.'
      );
      return;
    }

    const requested = await Location.requestForegroundPermissionsAsync();
    if (!requested.granted) {
      setStatus('denied');
      return;
    }

    setLoadNonce((nonce) => nonce + 1);
  }, []);

  const retry = useCallback(() => {
    forceRefreshRef.current = true;
    setError('');
    setLoadNonce((nonce) => nonce + 1);
  }, []);

  return {
    schools: nearbyFilter === filter ? nearbySchools : NO_SCHOOLS,
    origin: nearbyOrigin,
    status,
    error,
    enableLocation,
    retry,
  };
}
