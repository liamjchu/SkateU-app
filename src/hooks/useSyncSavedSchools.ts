import { useEffect, useRef } from 'react';
import { getApiUrl } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useFavorites } from '../store/favoritesStore';

export function useSyncSavedSchools(): void {
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);
  const hasHydrated = useFavorites((state) => state.hasHydrated);
  const favoriteSchoolIds = useFavorites((state) => state.favoriteSchoolIds);
  const addFavoriteSchoolId = useFavorites((state) => state.addFavoriteSchoolId);
  const lastSyncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !accessToken) {
      lastSyncedKey.current = null;
      return;
    }

    const localKey = favoriteSchoolIds.slice().sort().join(',');
    const syncKey = `${accessToken}:${localKey}`;
    if (lastSyncedKey.current === syncKey) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const sync = async () => {
      try {
        const getResponse = await fetch(getApiUrl('/api/saved-schools'), {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!getResponse.ok) {
          throw new Error('Couldn’t load saved schools right now.');
        }
        const payload = (await getResponse.json()) as { schoolIds?: unknown };
        const remoteIds = Array.isArray(payload.schoolIds)
          ? payload.schoolIds.filter(
              (id): id is string => typeof id === 'string' && id.length > 0
            )
          : [];

        const merged = [...new Set([...favoriteSchoolIds, ...remoteIds])];
        if (!cancelled) {
          for (const id of remoteIds) {
            addFavoriteSchoolId(id);
          }
        }

        const putResponse = await fetch(getApiUrl('/api/saved-schools'), {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ schoolIds: merged }),
          signal: controller.signal,
        });
        if (!putResponse.ok) {
          throw new Error('Couldn’t sync saved schools right now.');
        }
        if (!cancelled) {
          lastSyncedKey.current = `${accessToken}:${merged.slice().sort().join(',')}`;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.warn('Could not sync saved schools', error);
      }
    };

    void sync();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    accessToken,
    addFavoriteSchoolId,
    favoriteSchoolIds,
    hasHydrated,
  ]);
}
