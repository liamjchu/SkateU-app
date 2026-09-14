import { useEffect } from 'react';
import { prefetchUserLocation } from '../lib/prefetchUserLocation';

/**
 * Warms GPS into locationStore when foreground permission is already granted.
 * Does not prompt.
 */
export function usePrefetchUserLocation(): void {
  useEffect(() => {
    let cancelled = false;
    void prefetchUserLocation(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);
}
