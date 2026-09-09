import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getClientStorage } from '../lib/clientStorage';
import {
  buildSpotDraft,
  capDraftsForUser,
  createDraftId,
  draftsForSchool as selectDraftsForSchool,
  draftsForUser as selectDraftsForUser,
  isStaleSubmittingDraft,
  parseSpotDrafts,
} from '../lib/spotDraft';
import {
  copyDraftImages,
  deleteDraftFiles,
} from '../lib/spotDraftFiles';
import {
  abortDraftSubmission,
  isDraftSubmissionInFlight,
  SPOT_SUBMISSION_TIMEOUT_MS,
  SUBMISSION_CANCELLED_ERROR,
  SUBMISSION_STALE_ERROR,
} from '../lib/spotSubmission';
import type { SpotDraft, SpotDraftInput, SpotDraftStatus } from '../types/spotDraft';

type DraftSpotsState = {
  drafts: SpotDraft[];
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  upsertDraft: (input: SpotDraftInput) => Promise<SpotDraft>;
  setDraftStatus: (
    id: string,
    status: SpotDraftStatus,
    lastError?: string | null
  ) => void;
  cancelDraftSubmission: (id: string) => void;
  recoverStaleSubmittingDrafts: (nowMs?: number) => void;
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
        if (existing?.status === 'submitting' && input.status !== 'draft') {
          return existing;
        }
        const now = new Date().toISOString();
        const draftId = input.id ?? createDraftId();
        const copiedImages = await copyDraftImages(draftId, input.images);
        const latestExisting =
          get().drafts.find((draft) => draft.id === draftId) ?? existing;
        if (latestExisting?.status === 'submitting' && input.status !== 'draft') {
          return latestExisting;
        }
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
      setDraftStatus: (id, status, lastError) => {
        const now = new Date().toISOString();
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id
              ? {
                  ...draft,
                  status,
                  updatedAt: now,
                  ...(lastError !== undefined ? { lastError } : {}),
                }
              : draft
          ),
        }));
      },
      cancelDraftSubmission: (id) => {
        const draft = get().getDraft(id);
        abortDraftSubmission(id);
        if (!draft || draft.status !== 'submitting') {
          return;
        }
        get().setDraftStatus(id, 'draft', SUBMISSION_CANCELLED_ERROR);
      },
      recoverStaleSubmittingDrafts: (nowMs = Date.now()) => {
        const staleIds: string[] = [];
        for (const draft of get().drafts) {
          const inFlight = isDraftSubmissionInFlight(draft.id);
          if (
            !isStaleSubmittingDraft(draft, {
              nowMs,
              timeoutMs: SPOT_SUBMISSION_TIMEOUT_MS,
              inFlight,
            })
          ) {
            continue;
          }
          if (inFlight) {
            abortDraftSubmission(draft.id);
          }
          staleIds.push(draft.id);
        }
        if (staleIds.length === 0) {
          return;
        }
        const staleIdSet = new Set(staleIds);
        const now = new Date(nowMs).toISOString();
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            staleIdSet.has(draft.id)
              ? {
                  ...draft,
                  status: 'draft' as const,
                  lastError: SUBMISSION_STALE_ERROR,
                  updatedAt: now,
                }
              : draft
          ),
        }));
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
        const store = useDraftSpotsStore.getState();
        store.setHasHydrated(true);
        store.recoverStaleSubmittingDrafts();
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
