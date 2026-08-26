import { getSpotFormMissingSummary, isAddSpotFormValid } from './addSpotForm';
import type { SpotImageAsset, SpotMediaItem } from '../types/spot';
import type {
  SpotDraft,
  SpotDraftInput,
  SpotDraftStatus,
} from '../types/spotDraft';

export const MAX_SPOT_DRAFTS = 20;

export function createDraftId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isMeaningfulDraftContent(input: {
  name: string;
  description: string;
  imageCount: number;
  locationChanged: boolean;
}): boolean {
  return (
    input.imageCount > 0 ||
    input.name.trim().length > 0 ||
    input.description.trim().length > 0 ||
    input.locationChanged
  );
}

export function mediaToDraftImages(media: SpotMediaItem[]): SpotImageAsset[] {
  return media.map((item) =>
    item.kind === 'new' ? item.asset : { uri: item.uri }
  );
}

export function draftImagesToMedia(images: SpotImageAsset[]): SpotMediaItem[] {
  return images.map((asset) => ({ kind: 'new', asset }));
}

export function parseDraftStatus(value: unknown): SpotDraftStatus {
  return value === 'submitting' ? 'submitting' : 'draft';
}

export function getDraftStatusHint(
  draft: Pick<SpotDraft, 'name' | 'description' | 'images' | 'status' | 'lastError'>
): string {
  if (draft.status === 'submitting') {
    return 'Submitting…';
  }

  if (draft.lastError) {
    return draft.lastError;
  }

  if (isAddSpotFormValid(draft.images.length, draft.name, draft.description)) {
    return 'Ready to post';
  }

  return (
    getSpotFormMissingSummary(
      draft.images.length,
      draft.name,
      draft.description
    ) ?? 'Keep working'
  );
}

export function sortDraftsByUpdatedAt(drafts: SpotDraft[]): SpotDraft[] {
  return [...drafts].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function draftsForUser(
  drafts: SpotDraft[],
  userId: string
): SpotDraft[] {
  return sortDraftsByUpdatedAt(
    drafts.filter(
      (draft) => draft.userId === userId && draft.status !== 'submitting'
    )
  );
}

export function submittingDraftsForUser(
  drafts: SpotDraft[],
  userId: string
): SpotDraft[] {
  return sortDraftsByUpdatedAt(
    drafts.filter(
      (draft) => draft.userId === userId && draft.status === 'submitting'
    )
  );
}

export function draftsForSchool(
  drafts: SpotDraft[],
  userId: string,
  schoolId: string
): SpotDraft[] {
  return draftsForUser(drafts, userId).filter(
    (draft) => draft.schoolId === schoolId
  );
}

export function capDraftsForUser(
  drafts: SpotDraft[],
  userId: string,
  keepId: string
): { kept: SpotDraft[]; removed: SpotDraft[] } {
  const others = drafts.filter((draft) => draft.userId !== userId);
  const userDrafts = sortDraftsByUpdatedAt(
    drafts.filter((draft) => draft.userId === userId)
  );
  const keepFirst = [
    ...userDrafts.filter((draft) => draft.id === keepId),
    ...userDrafts.filter((draft) => draft.id !== keepId),
  ];
  const keptUser = keepFirst.slice(0, MAX_SPOT_DRAFTS);
  const removed = keepFirst.slice(MAX_SPOT_DRAFTS);

  return { kept: [...others, ...keptUser], removed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDraftImage(value: unknown): SpotImageAsset | null {
  if (!isRecord(value) || typeof value.uri !== 'string' || value.uri.length === 0) {
    return null;
  }

  const image: SpotImageAsset = { uri: value.uri };
  if (typeof value.fileName === 'string' && value.fileName.length > 0) {
    image.fileName = value.fileName;
  }
  if (typeof value.mimeType === 'string' && value.mimeType.length > 0) {
    image.mimeType = value.mimeType;
  }

  return image;
}

export function parseSpotDraft(value: unknown): SpotDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.userId !== 'string' ||
    value.userId.length === 0 ||
    typeof value.schoolId !== 'string' ||
    value.schoolId.length === 0 ||
    typeof value.schoolName !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.latitude !== 'number' ||
    !Number.isFinite(value.latitude) ||
    typeof value.longitude !== 'number' ||
    !Number.isFinite(value.longitude) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !Array.isArray(value.images)
  ) {
    return null;
  }

  const images = value.images
    .map(parseDraftImage)
    .filter((image): image is SpotImageAsset => image !== null);

  return {
    id: value.id,
    userId: value.userId,
    schoolId: value.schoolId,
    schoolName: value.schoolName,
    name: value.name,
    description: value.description,
    latitude: value.latitude,
    longitude: value.longitude,
    images,
    status: parseDraftStatus(value.status),
    lastError:
      typeof value.lastError === 'string' && value.lastError.trim().length > 0
        ? value.lastError.trim()
        : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseSpotDrafts(value: unknown): SpotDraft[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parseSpotDraft)
    .filter((draft): draft is SpotDraft => draft !== null);
}

export function buildSpotDraft(
  input: SpotDraftInput,
  existing: SpotDraft | undefined,
  now: string
): SpotDraft {
  return {
    id: input.id ?? existing?.id ?? createDraftId(),
    userId: input.userId,
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    name: input.name,
    description: input.description,
    latitude: input.latitude,
    longitude: input.longitude,
    images: input.images,
    status: input.status ?? existing?.status ?? 'draft',
    lastError:
      input.lastError !== undefined
        ? input.lastError
        : existing?.lastError ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
