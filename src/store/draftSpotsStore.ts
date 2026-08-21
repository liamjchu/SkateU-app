import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getClientStorage } from '../lib/clientStorage';
import {
  buildSpotDraft,
  capDraftsForUser,
  createDraftId,
  draftsForSchool as selectDraftsForSchool,
  draftsForUser as selectDraftsForUser,
  parseSpotDrafts,
} from '../lib/spotDraft';
import {
  copyDraftImages,
  deleteDraftFiles,
} from '../lib/spotDraftFiles';
import type { SpotDraft, SpotDraftInput } from '../types/spotDraft';

type DraftSpotsState = {
  drafts: SpotDraft[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  upsertDraft: (input: SpotDraftInput) => Promise<SpotDraft>;
  deleteDraft: (id: string) => Promise<void>;
  getDraft: (id: string) => SpotDraft | undefined;
  draftsForUser: (userId: string) => SpotDraft[];
  draftsForSchool: (userId: string, schoolId: string) => SpotDraft[];
  clearUserDrafts: (userId: string) => Promise<void>;
  reset: () => void;
};

export const useDraftSpotsStore = create<DraftSpotsState>()(
  persist(
    (set, get) => ({
      drafts: [],
      hasHydrated: false,
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
      upsertDraft: async (input) => {
        const existing = input.id
          ? get().drafts.find((draft) => draft.id === input.id)
          : undefined;
        const now = new Date().toISOString();
        const draftId = input.id ?? existing?.id ?? createDraftId();
        const copiedImages = await copyDraftImages(draftId, input.images);
        const latestExisting =
          get().drafts.find((draft) => draft.id === draftId) ?? existing;
        const draft = buildSpotDraft(
          { ...input, id: draftId, images: copiedImages },
          latestExisting,
          now
        );
        const nextDrafts = get().drafts.some((item) => item.id === draft.id)
          ? get().drafts.map((item) => (item.id === draft.id ? draft : item))
          : [draft, ...get().drafts];
        const { kept, removed } = capDraftsForUser(
          nextDrafts,
          draft.userId,
          draft.id
        );

        await Promise.all(removed.map((item) => deleteDraftFiles(item.id)));
        set({ drafts: kept });
        return draft;
      },
      deleteDraft: async (id) => {
        await deleteDraftFiles(id);
        set((state) => ({
          drafts: state.drafts.filter((draft) => draft.id !== id),
        }));
      },
      getDraft: (id) => get().drafts.find((draft) => draft.id === id),
      draftsForUser: (userId) => selectDraftsForUser(get().drafts, userId),
      draftsForSchool: (userId, schoolId) =>
        selectDraftsForSchool(get().drafts, userId, schoolId),
      clearUserDrafts: async (userId) => {
        const toRemove = get().drafts.filter((draft) => draft.userId === userId);
        await Promise.all(toRemove.map((draft) => deleteDraftFiles(draft.id)));
        set((state) => ({
          drafts: state.drafts.filter((draft) => draft.userId !== userId),
        }));
      },
      reset: () => set({ drafts: [] }),
    }),
    {
      name: '@skateu:spot-drafts',
      storage: createJSONStorage(getClientStorage),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useDraftSpotsStore.getState().setHasHydrated(true);
      },
      partialize: (state) => ({
        drafts: state.drafts,
      }),
      merge: (persistedState, currentState) => {
        const persistedDrafts =
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'drafts' in persistedState
            ? parseSpotDrafts(persistedState.drafts)
            : [];

        return {
          ...currentState,
          drafts: persistedDrafts,
        };
      },
    }
  )
);
