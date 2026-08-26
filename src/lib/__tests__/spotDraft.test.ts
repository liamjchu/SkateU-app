import {
    buildSpotDraft,
    capDraftsForUser,
    createDraftId,
    draftsForSchool,
    draftsForUser,
    draftImagesToMedia,
    submittingDraftsForUser,
    getDraftStatusHint,
    isMeaningfulDraftContent,
    MAX_SPOT_DRAFTS,
    mediaToDraftImages,
    parseSpotDrafts,
} from '../spotDraft';
import type { SpotMediaItem } from '../../types/spot';
import type { SpotDraft } from '../../types/spotDraft';

function makeDraft(overrides: Partial<SpotDraft> = {}): SpotDraft {
  return {
    id: 'draft-1',
    userId: 'user-1',
    schoolId: 'school-1',
    schoolName: 'Brown',
    name: 'Library five-stair',
    description: 'Icy in winter',
    latitude: 41.82,
    longitude: -71.4,
    images: [{ uri: 'file:///cover.jpg' }],
    status: 'draft',
    lastError: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('spotDraft helpers', () => {
  it('creates a non-empty draft id', () => {
    expect(createDraftId().length).toBeGreaterThan(8);
  });

  it('treats text, photos, or a moved pin as meaningful content', () => {
    expect(
      isMeaningfulDraftContent({
        name: '',
        description: '',
        imageCount: 0,
        locationChanged: false,
      })
    ).toBe(false);
    expect(
      isMeaningfulDraftContent({
        name: 'Rail',
        description: '',
        imageCount: 0,
        locationChanged: false,
      })
    ).toBe(true);
    expect(
      isMeaningfulDraftContent({
        name: '',
        description: '',
        imageCount: 1,
        locationChanged: false,
      })
    ).toBe(true);
    expect(
      isMeaningfulDraftContent({
        name: '',
        description: '',
        imageCount: 0,
        locationChanged: true,
      })
    ).toBe(true);
  });

  it('round-trips media items to draft images as new assets', () => {
    const media: SpotMediaItem[] = [
      { kind: 'new', asset: { uri: 'file:///a.jpg', fileName: 'a.jpg' } },
      { kind: 'existing', uri: 'file:///b.jpg' },
    ];

    expect(mediaToDraftImages(media)).toEqual([
      { uri: 'file:///a.jpg', fileName: 'a.jpg' },
      { uri: 'file:///b.jpg' },
    ]);
    expect(draftImagesToMedia([{ uri: 'file:///a.jpg' }])).toEqual([
      { kind: 'new', asset: { uri: 'file:///a.jpg' } },
    ]);
  });

  it('labels complete drafts as ready to post', () => {
    expect(getDraftStatusHint(makeDraft())).toBe('Ready to post');
    expect(
      getDraftStatusHint(
        makeDraft({ name: '', description: '', images: [] })
      )
    ).toBe('Still needs a name, a photo, and a description.');
    expect(
      getDraftStatusHint(makeDraft({ images: [] }))
    ).toBe('Still needs a photo.');
    expect(
      getDraftStatusHint(makeDraft({ status: 'submitting' }))
    ).toBe('Submitting…');
    expect(
      getDraftStatusHint(
        makeDraft({ lastError: 'Let’s try a different photo for this one.' })
      )
    ).toBe('Let’s try a different photo for this one.');
  });

  it('filters drafts by user and school, newest first', () => {
    const drafts = [
      makeDraft({
        id: 'older',
        updatedAt: '2026-01-01T00:00:00.000Z',
        schoolId: 'school-1',
      }),
      makeDraft({
        id: 'newer',
        updatedAt: '2026-01-03T00:00:00.000Z',
        schoolId: 'school-1',
      }),
      makeDraft({
        id: 'other-school',
        schoolId: 'school-2',
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
      makeDraft({
        id: 'other-user',
        userId: 'user-2',
        updatedAt: '2026-01-05T00:00:00.000Z',
      }),
    ];

    expect(draftsForUser(drafts, 'user-1').map((draft) => draft.id)).toEqual([
      'other-school',
      'newer',
      'older',
    ]);
    expect(draftsForSchool(drafts, 'user-1', 'school-1').map((draft) => draft.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('keeps submitting spots out of the draft list', () => {
    const drafts = [
      makeDraft({ id: 'ready' }),
      makeDraft({
        id: 'in-flight',
        status: 'submitting',
        updatedAt: '2026-01-06T00:00:00.000Z',
      }),
    ];

    expect(draftsForUser(drafts, 'user-1').map((draft) => draft.id)).toEqual([
      'ready',
    ]);
    expect(draftsForSchool(drafts, 'user-1', 'school-1').map((draft) => draft.id)).toEqual([
      'ready',
    ]);
    expect(
      submittingDraftsForUser(drafts, 'user-1').map((draft) => draft.id)
    ).toEqual(['in-flight']);
  });

  it('keeps the newest drafts per user up to the cap', () => {
    const drafts = Array.from({ length: MAX_SPOT_DRAFTS + 2 }, (_, index) =>
      makeDraft({
        id: `draft-${index}`,
        updatedAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    );
    const keepId = `draft-${MAX_SPOT_DRAFTS + 1}`;
    const { kept, removed } = capDraftsForUser(drafts, 'user-1', keepId);

    expect(kept).toHaveLength(MAX_SPOT_DRAFTS);
    expect(kept.some((draft) => draft.id === keepId)).toBe(true);
    expect(removed).toHaveLength(2);
    expect(removed.map((draft) => draft.id)).toEqual(['draft-1', 'draft-0']);
  });

  it('does not cap another user’s drafts', () => {
    const drafts = [
      ...Array.from({ length: MAX_SPOT_DRAFTS }, (_, index) =>
        makeDraft({
          id: `mine-${index}`,
          updatedAt: `2026-02-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
        })
      ),
      makeDraft({
        id: 'theirs',
        userId: 'user-2',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ];
    const keepId = 'mine-19';
    const { kept, removed } = capDraftsForUser(drafts, 'user-1', keepId);

    expect(removed).toHaveLength(0);
    expect(kept.some((draft) => draft.id === 'theirs')).toBe(true);
    expect(kept).toHaveLength(MAX_SPOT_DRAFTS + 1);
  });

  it('parses persisted drafts and drops invalid rows', () => {
    const parsed = parseSpotDrafts([
      makeDraft(),
      { id: 'nope' },
      null,
      {
        ...makeDraft({ id: 'draft-2' }),
        images: [{ uri: 'file:///ok.jpg' }, { uri: '' }, 'bad'],
      },
    ]);

    expect(parsed.map((draft) => draft.id)).toEqual(['draft-1', 'draft-2']);
    expect(parsed[1].images).toEqual([{ uri: 'file:///ok.jpg' }]);
    expect(parsed[0].lastError).toBeNull();
  });

  it('reuses createdAt when updating a draft', () => {
    const existing = makeDraft();
    const next = buildSpotDraft(
      {
        id: existing.id,
        userId: existing.userId,
        schoolId: existing.schoolId,
        schoolName: existing.schoolName,
        name: 'Updated',
        description: existing.description,
        latitude: existing.latitude,
        longitude: existing.longitude,
        images: existing.images,
      },
      existing,
      '2026-03-01T00:00:00.000Z'
    );

    expect(next.createdAt).toBe(existing.createdAt);
    expect(next.updatedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(next.name).toBe('Updated');
  });
});
