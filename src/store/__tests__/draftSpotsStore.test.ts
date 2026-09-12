import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SpotDraftInput } from '../../types/spotDraft';
import { MAX_SPOT_DRAFTS } from '../../lib/spotDraft';
import {
  beginDraftSubmission,
  resetDraftSubmissions,
  SUBMISSION_CANCELLED_ERROR,
  SUBMISSION_STALE_ERROR,
} from '../../lib/spotSubmission';
import { useDraftSpotsStore } from '../draftSpotsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../lib/spotDraftFiles', () => ({
  copyDraftImages: jest.fn(
    async (_draftId: string, images: SpotDraftInput['images']) => images
  ),
  deleteDraftFiles: jest.fn(async () => undefined),
  filterExistingDraftImages: jest.fn(
    async (images: SpotDraftInput['images']) => images
  ),
}));

function makeInput(overrides: Partial<SpotDraftInput> = {}): SpotDraftInput {
  return {
    userId: 'user-1',
    schoolId: 'school-1',
    schoolName: 'Brown',
    name: 'Library five-stair',
    description: 'Icy in winter',
    latitude: 41.82,
    longitude: -71.4,
    images: [{ uri: 'file:///cover.jpg' }],
    ...overrides,
  };
}

describe('draftSpotsStore', () => {
  beforeEach(() => {
    useDraftSpotsStore.getState().reset();
    useDraftSpotsStore.setState({ hasHydrated: true });
  });

  afterEach(async () => {
    resetDraftSubmissions();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('upserts a draft for the signed-in user and can look it up', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());

    expect(draft.userId).toBe('user-1');
    expect(draft.schoolId).toBe('school-1');
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.name).toBe(
      'Library five-stair'
    );
    expect(
      useDraftSpotsStore.getState().draftsForUser('user-1')
    ).toHaveLength(1);
    expect(
      useDraftSpotsStore.getState().draftsForUser('user-2')
    ).toHaveLength(0);
  });

  it('filters drafts for a campus', async () => {
    await useDraftSpotsStore.getState().upsertDraft(makeInput({ name: 'A' }));
    await useDraftSpotsStore.getState().upsertDraft(
      makeInput({ schoolId: 'school-2', schoolName: 'RISD', name: 'B' })
    );

    const campusDrafts = useDraftSpotsStore
      .getState()
      .draftsForSchool('user-1', 'school-1');
    expect(campusDrafts).toHaveLength(1);
    expect(campusDrafts[0].name).toBe('A');
  });

  it('updates an existing draft in place', async () => {
    const created = await useDraftSpotsStore
      .getState()
      .upsertDraft(makeInput({ name: 'First' }));
    const updated = await useDraftSpotsStore.getState().upsertDraft(
      makeInput({ id: created.id, name: 'Second' })
    );

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(useDraftSpotsStore.getState().drafts).toHaveLength(1);
    expect(useDraftSpotsStore.getState().getDraft(created.id)?.name).toBe(
      'Second'
    );
  });

  it('sets a draft to submitting without copying files again', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');

    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'submitting'
    );
    expect(
      useDraftSpotsStore.getState().draftsForUser('user-1')
    ).toHaveLength(0);
  });

  it('stores a submit error on the draft so it can be shown later', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');
    useDraftSpotsStore.getState().setDraftStatus(
      draft.id,
      'draft',
      'Let’s try a different photo for this one.'
    );

    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'draft'
    );
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.lastError).toBe(
      'Let’s try a different photo for this one.'
    );
    expect(
      useDraftSpotsStore.getState().draftsForUser('user-1')
    ).toHaveLength(1);
  });

  it('creates a second draft on the same campus while one is submitting', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');

    const next = await useDraftSpotsStore.getState().upsertDraft(
      makeInput({ name: 'Duplicate rail' })
    );

    expect(next.id).not.toBe(draft.id);
    expect(useDraftSpotsStore.getState().drafts).toHaveLength(2);
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'submitting'
    );
    expect(useDraftSpotsStore.getState().getDraft(next.id)?.name).toBe(
      'Duplicate rail'
    );
  });

  it('does not overwrite a submitting draft in place', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');

    const next = await useDraftSpotsStore.getState().upsertDraft(
      makeInput({ id: draft.id, name: 'Changed' })
    );

    expect(next.id).toBe(draft.id);
    expect(next.name).toBe(draft.name);
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'submitting'
    );
  });

  it('cancels an in-flight submission and restores the draft', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');
    const signal = beginDraftSubmission(draft.id);

    useDraftSpotsStore.getState().cancelDraftSubmission(draft.id);

    expect(signal.aborted).toBe(true);
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'draft'
    );
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.lastError).toBe(
      SUBMISSION_CANCELLED_ERROR
    );
  });

  it('recovers submitting drafts with no in-flight request', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');

    useDraftSpotsStore.getState().recoverStaleSubmittingDrafts();

    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'draft'
    );
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.lastError).toBe(
      SUBMISSION_STALE_ERROR
    );
  });

  it('keeps a live submitting draft until the request times out', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(draft.id, 'submitting');
    beginDraftSubmission(draft.id);
    const startedAt = Date.parse(
      useDraftSpotsStore.getState().getDraft(draft.id)?.updatedAt ?? ''
    );

    useDraftSpotsStore.getState().recoverStaleSubmittingDrafts(startedAt + 30_000);

    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'submitting'
    );

    useDraftSpotsStore.getState().recoverStaleSubmittingDrafts(startedAt + 61_000);

    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.status).toBe(
      'draft'
    );
    expect(useDraftSpotsStore.getState().getDraft(draft.id)?.lastError).toBe(
      SUBMISSION_STALE_ERROR
    );
  });

  it('restores a persisted submitting draft as retryable on rehydrate', async () => {
    const created = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    useDraftSpotsStore.getState().setDraftStatus(created.id, 'submitting');
    const persisted = await AsyncStorage.getItem('@skateu:spot-drafts');
    expect(persisted).toContain('"status":"submitting"');

    useDraftSpotsStore.setState({ drafts: [], hasHydrated: false });
    if (persisted) {
      await AsyncStorage.setItem('@skateu:spot-drafts', persisted);
    }
    await useDraftSpotsStore.persist.rehydrate();

    expect(useDraftSpotsStore.getState().getDraft(created.id)?.status).toBe(
      'draft'
    );
    expect(useDraftSpotsStore.getState().getDraft(created.id)?.lastError).toBe(
      SUBMISSION_STALE_ERROR
    );
    expect(useDraftSpotsStore.getState().hasHydrated).toBe(true);
  });

  it('deletes a draft after a successful post', async () => {
    const draft = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    await useDraftSpotsStore.getState().deleteDraft(draft.id);

    expect(useDraftSpotsStore.getState().getDraft(draft.id)).toBeUndefined();
    expect(useDraftSpotsStore.getState().drafts).toHaveLength(0);
  });

  it('clears only the deleted account’s drafts', async () => {
    await useDraftSpotsStore.getState().upsertDraft(makeInput());
    await useDraftSpotsStore
      .getState()
      .upsertDraft(makeInput({ userId: 'user-2', name: 'Theirs' }));

    await useDraftSpotsStore.getState().clearUserDrafts('user-1');

    expect(useDraftSpotsStore.getState().draftsForUser('user-1')).toHaveLength(
      0
    );
    expect(useDraftSpotsStore.getState().draftsForUser('user-2')).toHaveLength(
      1
    );
  });

  it('caps stored drafts per user', async () => {
    for (let index = 0; index < MAX_SPOT_DRAFTS + 3; index += 1) {
      await useDraftSpotsStore.getState().upsertDraft(
        makeInput({ name: `Spot ${index}` })
      );
    }

    expect(useDraftSpotsStore.getState().draftsForUser('user-1')).toHaveLength(
      MAX_SPOT_DRAFTS
    );
  });

  it('persists drafts to AsyncStorage and restores them on rehydrate', async () => {
    const created = await useDraftSpotsStore.getState().upsertDraft(makeInput());
    const persisted = await AsyncStorage.getItem('@skateu:spot-drafts');
    expect(persisted).toContain('Library five-stair');

    useDraftSpotsStore.setState({ drafts: [], hasHydrated: false });
    if (persisted) {
      await AsyncStorage.setItem('@skateu:spot-drafts', persisted);
    }
    await useDraftSpotsStore.persist.rehydrate();

    expect(useDraftSpotsStore.getState().getDraft(created.id)?.name).toBe(
      'Library five-stair'
    );
    expect(useDraftSpotsStore.getState().hasHydrated).toBe(true);
  });
});
