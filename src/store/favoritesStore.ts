import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type FavoritesStore = {
  favoriteSchoolIds: string[];
  addFavoriteSchool: (id: string) => void;
  removeFavoriteSchool: (id: string) => void;
  toggleFavoriteSchool: (id: string) => void;
  isFavoriteSchool: (id: string) => boolean;
};

export const useFavorites = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favoriteSchoolIds: [],
      addFavoriteSchool: (id: string) => {
        set((state) => {
          if (state.favoriteSchoolIds.includes(id)) {
            return state;
          }

          return {
            favoriteSchoolIds: [...state.favoriteSchoolIds, id],
          };
        });
      },
      removeFavoriteSchool: (id: string) => {
        set((state) => ({
          favoriteSchoolIds: state.favoriteSchoolIds.filter((schoolId) => schoolId !== id),
        }));
      },
      toggleFavoriteSchool: (id: string) => {
        const { addFavoriteSchool, isFavoriteSchool, removeFavoriteSchool } = get();

        if (isFavoriteSchool(id)) {
          removeFavoriteSchool(id);
          return;
        }

        addFavoriteSchool(id);
      },
      isFavoriteSchool: (id: string) => get().favoriteSchoolIds.includes(id),
    }),
    {
      name: '@skateu:favorite-schools',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ favoriteSchoolIds: state.favoriteSchoolIds }),
    }
  )
);
