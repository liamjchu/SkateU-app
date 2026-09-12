import { useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../lib/api';
import { toUserFacingError } from '../lib/userFacingError';
import { useFavorites } from '../store/favoritesStore';
import { useSchools } from '../store/schoolsStore';
import type { School } from '../types/school';

type SchoolsLookupResponse = {
  schools: School[];
};

export function useHydrateFavoriteSchools() {
  const schools = useSchools((state) => state.schools);
  const upsertSchool = useSchools((state) => state.upsertSchool);
  const {
    favoriteSchoolIds,
    favoriteSchools: storedFavoriteSchools,
    hasHydrated: hasHydratedFavorites,
    upsertFavoriteSchool,
  } = useFavorites();

  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);

  const favoriteSchools = useMemo(
    () =>
      favoriteSchoolIds
        .map((schoolId) => {
          const school =
            schools.find((item) => item.id === schoolId) ??
            storedFavoriteSchools.find((item) => item.id === schoolId);

          return school;
        })
        .filter((school): school is School => Boolean(school)),
    [favoriteSchoolIds, schools, storedFavoriteSchools]
  );

  useEffect(() => {
    if (!hasHydratedFavorites) {
      setIsHydrating(true);
      return;
    }

    const missingFavoriteSchoolIds = favoriteSchoolIds.filter(
      (schoolId) => !schools.some((school) => school.id === schoolId)
    );

    if (missingFavoriteSchoolIds.length === 0) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);
    const controller = new AbortController();

    const fetchMissingFavoriteSchools = async () => {
      try {
        const response = await fetch(
          getApiUrl(
            `/api/schools?ids=${encodeURIComponent(missingFavoriteSchoolIds.join(','))}`
          ),
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorData?.error ??
              `Saved schools lookup failed with status ${response.status}`
          );
        }

        const data = (await response.json()) as SchoolsLookupResponse;
        data.schools.forEach((school) => {
          upsertSchool(school);
          upsertFavoriteSchool(school);
        });
        if (!cancelled) {
          setError('');
        }
      } catch (caught) {
        if (caught instanceof Error && caught.name === 'AbortError') {
          return;
        }

        if (!cancelled) {
          setError(
            toUserFacingError(caught, 'Couldn’t load saved schools right now.')
          );
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    };

    void fetchMissingFavoriteSchools();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    favoriteSchoolIds,
    hasHydratedFavorites,
    retryNonce,
    schools,
    upsertFavoriteSchool,
    upsertSchool,
  ]);

  return {
    favoriteSchools,
    favoriteSchoolIds,
    isHydrating,
    error,
    retry: () => {
      setError('');
      setRetryNonce((nonce) => nonce + 1);
    },
  };
}
