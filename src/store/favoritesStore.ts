import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { School } from '../types/school';

type FavoritesStore = {
  favoriteSchoolIds: string[];
  favoriteSchools: School[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  addFavoriteSchool: (school: School) => void;
  removeFavoriteSchool: (id: string) => void;
  toggleFavoriteSchool: (school: School) => void;
  upsertFavoriteSchool: (school: School) => void;
  isFavoriteSchool: (id: string) => boolean;
};

function mergeFavoriteSchools(schools: School[]) {
  const schoolMap = new Map<string, School>();

  schools.forEach((school) => schoolMap.set(school.id, school));

  return Array.from(schoolMap.values());
}

export const useFavorites = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favoriteSchoolIds: [],
      favoriteSchools: [],
      hasHydrated: false,
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
      addFavoriteSchool: (school: School) => {
        set((state) => ({
          favoriteSchoolIds: state.favoriteSchoolIds.includes(school.id)
            ? state.favoriteSchoolIds
            : [...state.favoriteSchoolIds, school.id],
          favoriteSchools: mergeFavoriteSchools([
            ...state.favoriteSchools,
            school,
          ]),
        }));
      },
      removeFavoriteSchool: (id: string) => {
        set((state) => ({
          favoriteSchoolIds: state.favoriteSchoolIds.filter(
            (schoolId) => schoolId !== id
          ),
          favoriteSchools: state.favoriteSchools.filter(
            (school) => school.id !== id
          ),
        }));
      },
      toggleFavoriteSchool: (school: School) => {
        if (get().isFavoriteSchool(school.id)) {
          get().removeFavoriteSchool(school.id);
          return;
        }

        get().addFavoriteSchool(school);
      },
      upsertFavoriteSchool: (school: School) => {
        set((state) => {
          if (!state.favoriteSchoolIds.includes(school.id)) {
            return state;
          }

          return {
            favoriteSchools: mergeFavoriteSchools([
              ...state.favoriteSchools,
              school,
            ]),
          };
        });
      },
      isFavoriteSchool: (id: string) =>
        get().favoriteSchoolIds.includes(id),
    }),
    {
      name: '@skateu:favorite-schools',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        favoriteSchoolIds: state.favoriteSchoolIds,
      }),
      merge: (persistedState, currentState) => {
        const persistedFavoriteIds =
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'favoriteSchoolIds' in persistedState &&
          Array.isArray(persistedState.favoriteSchoolIds)
            ? persistedState.favoriteSchoolIds
            : [];

        return {
          ...currentState,
          favoriteSchoolIds: persistedFavoriteIds,
          favoriteSchools: [],
        };
      },
    }
  )
);
