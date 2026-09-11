import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getClientStorage } from '../lib/clientStorage';
import { parseSeenSpotIds, rememberSeenSpotIds } from '../lib/feedSeen';

export const FEED_SEEN_CACHE_KEY = '@skateu:feed-seen';

type FeedSeenState = {
  seenSpotIds: string[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  markSeen: (spotId: string) => void;
};

export const useFeedSeenStore = create<FeedSeenState>()(
  persist(
    (set, get) => ({
      seenSpotIds: [],
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      markSeen: (spotId) => {
        if (spotId.length === 0) {
          return;
        }
        set({
          seenSpotIds: rememberSeenSpotIds(get().seenSpotIds, spotId),
        });
      },
    }),
    {
      name: FEED_SEEN_CACHE_KEY,
      storage: createJSONStorage(getClientStorage),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useFeedSeenStore.getState().setHasHydrated(true);
      },
      partialize: (state) => ({
        seenSpotIds: state.seenSpotIds,
      }),
      merge: (persistedState, currentState) => {
        const persistedIds =
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'seenSpotIds' in persistedState
            ? parseSeenSpotIds(persistedState.seenSpotIds)
            : [];

        return {
          ...currentState,
          seenSpotIds: persistedIds,
        };
      },
    }
  )
);
