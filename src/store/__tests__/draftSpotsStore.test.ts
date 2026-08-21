import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SpotDraftInput } from '../../types/spotDraft';
import { MAX_SPOT_DRAFTS } from '../../lib/spotDraft';
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
