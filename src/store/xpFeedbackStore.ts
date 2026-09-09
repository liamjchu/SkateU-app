import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getClientStorage } from '../lib/clientStorage';
import {
  formatXpGainToast,
  rankFromXp,
  type XpEventReason,
  type XpRank,
} from '../lib/xpRank';

export const XP_FEEDBACK_CACHE_KEY = '@skateu:xp-feedback';

export type XpToast = {
  title: string;
  message: string;
};

export type XpRankUp = {
  rank: XpRank;
};

type XpFeedbackState = {
  lastSeenUserId: string | null;
  lastSeenXp: number | null;
  hasHydrated: boolean;
  toast: XpToast | null;
  rankUp: XpRankUp | null;
  setHasHydrated: (hasHydrated: boolean) => void;
  applyXpSnapshot: (
    userId: string,
    xpTotal: number,
    reasonHint?: XpEventReason | null
  ) => void;
  clearToast: () => void;
  clearRankUp: () => void;
  resetForUser: () => void;
};

export const useXpFeedbackStore = create<XpFeedbackState>()(
  persist(
    (set, get) => ({
      lastSeenUserId: null,
      lastSeenXp: null,
      hasHydrated: false,
      toast: null,
      rankUp: null,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      applyXpSnapshot: (userId, xpTotal, reasonHint) => {
        const current = get();
        if (
          current.lastSeenUserId !== userId ||
          current.lastSeenXp === null
        ) {
          set({
            lastSeenUserId: userId,
            lastSeenXp: xpTotal,
            toast: null,
            rankUp: null,
          });
          return;
        }

        const previousXp = current.lastSeenXp;
        if (xpTotal === previousXp) {
          return;
        }

        if (xpTotal < previousXp) {
          set({ lastSeenXp: xpTotal });
          return;
        }

        const previousRank = rankFromXp(previousXp);
        const nextRank = rankFromXp(xpTotal);
        if (nextRank !== previousRank) {
          set({
            lastSeenXp: xpTotal,
            rankUp: { rank: nextRank },
            toast: null,
          });
          return;
        }

        set({
          lastSeenXp: xpTotal,
          toast: formatXpGainToast(xpTotal - previousXp, reasonHint),
          rankUp: null,
        });
      },
      clearToast: () => set({ toast: null }),
      clearRankUp: () => set({ rankUp: null }),
      resetForUser: () =>
        set({
          lastSeenUserId: null,
          lastSeenXp: null,
          toast: null,
          rankUp: null,
        }),
    }),
    {
      name: XP_FEEDBACK_CACHE_KEY,
      storage: createJSONStorage(getClientStorage),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useXpFeedbackStore.getState().setHasHydrated(true);
      },
      partialize: (state) => ({
        lastSeenUserId: state.lastSeenUserId,
        lastSeenXp: state.lastSeenXp,
      }),
    }
  )
);
