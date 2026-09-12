import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getClientStorage } from '../lib/clientStorage';
import { HOME_RAIL_PAGE_SIZE } from '../lib/homeFeed';
import { NEARBY_SCHOOLS_LIMIT, type NearbyOrigin } from '../lib/nearbySchools';
import {
  capNewest,
  parseCoordinates,
  parseSchoolFilter,
  parseSchools,
  readPersistedRecord,
  SCHOOLS_CACHE_CAP,
  SCHOOLS_CACHE_KEY,
} from '../lib/readCache';
import type { School, SchoolTypeFilter } from '../types/school';

type SchoolsStore = {
  schools: School[];
  popularSchools: School[];
  popularFilter: SchoolTypeFilter | null;
  nearbySchools: School[];
  nearbyFilter: SchoolTypeFilter | null;
  nearbyOrigin: NearbyOrigin | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  upsertSchool: (school: School) => void;
  setPopularFeed: (filter: SchoolTypeFilter, schools: School[]) => void;
  setNearbyFeed: (
    filter: SchoolTypeFilter,
    origin: NearbyOrigin,
    schools: School[]
  ) => void;
};

function withCatalogCap(schools: School[]): School[] {
  return capNewest(schools, SCHOOLS_CACHE_CAP);
}

export const useSchools = create<SchoolsStore>()(
  persist(
    (set) => ({
      schools: [],
      popularSchools: [],
      popularFilter: null,
      nearbySchools: [],
      nearbyFilter: null,
      nearbyOrigin: null,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      upsertSchool: (school: School) => {
        set((state) => ({
          schools: withCatalogCap([
            school,
            ...state.schools.filter((item) => item.id !== school.id),
          ]),
        }));
      },
      setPopularFeed: (filter, schools) => {
        set((state) => ({
          popularSchools: schools,
          popularFilter: filter,
          schools: withCatalogCap([
            ...schools,
            ...state.schools.filter(
              (item) => !schools.some((school) => school.id === item.id)
            ),
          ]),
        }));
      },
      setNearbyFeed: (filter, origin, schools) => {
        set((state) => ({
          nearbySchools: schools,
          nearbyFilter: filter,
          nearbyOrigin: origin,
          schools: withCatalogCap([
            ...schools,
            ...state.schools.filter(
              (item) => !schools.some((school) => school.id === item.id)
            ),
          ]),
        }));
      },
    }),
    {
      name: SCHOOLS_CACHE_KEY,
      storage: createJSONStorage(getClientStorage),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useSchools.getState().setHasHydrated(true);
      },
      partialize: (state) => ({
        schools: withCatalogCap(state.schools),
        popularSchools: capNewest(state.popularSchools, HOME_RAIL_PAGE_SIZE),
        popularFilter: state.popularFilter,
        nearbySchools: capNewest(state.nearbySchools, NEARBY_SCHOOLS_LIMIT),
        nearbyFilter: state.nearbyFilter,
        nearbyOrigin: state.nearbyOrigin,
      }),
      merge: (persistedState, currentState) => {
        const persisted = readPersistedRecord(persistedState);
        return {
          ...currentState,
          schools: withCatalogCap(parseSchools(persisted.schools)),
          popularSchools: capNewest(
            parseSchools(persisted.popularSchools),
            HOME_RAIL_PAGE_SIZE
          ),
          popularFilter: parseSchoolFilter(persisted.popularFilter),
          nearbySchools: capNewest(
            parseSchools(persisted.nearbySchools),
            NEARBY_SCHOOLS_LIMIT
          ),
          nearbyFilter: parseSchoolFilter(persisted.nearbyFilter),
          nearbyOrigin: parseCoordinates(persisted.nearbyOrigin),
        };
      },
    }
  )
);
