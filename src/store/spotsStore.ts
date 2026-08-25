import { create } from 'zustand';
import { captureAnalyticsEvent } from '../lib/analytics';
import { getApiUrl } from '../lib/api';
import { buildImageOrder } from '../lib/spotMedia';
import { sanitizeErrorMessage } from '../lib/userFacingError';
import type { NewSpotInput, Spot, UpdateSpotInput } from '../types/spot';
import type {
  SpotRemovalReason,
  SpotRemovalRequest,
} from '../types/spotRemovalRequest';


type SpotsState = {
  spots: Spot[];
  loading: boolean;
  error: string | null;
  schoolId: string | null;
  // The signed-in user's own spots (across all schools), for the profile page.
  mySpots: Spot[];
  myLoading: boolean;
  myError: string | null;
  // Spots the signed-in user has liked, for the profile page.
  likedSpots: Spot[];
  likedLoading: boolean;
  likedError: string | null;
  reportedSpotIds: string[];
  fetchSpots: (schoolId: string, accessToken?: string) => Promise<void>;
  addSpot: (input: NewSpotInput, accessToken: string) => Promise<Spot>;
  fetchMySpots: (accessToken: string) => Promise<void>;
  fetchLikedSpots: (accessToken: string) => Promise<void>;
  toggleSpotLike: (
    id: string,
    likedByUser: boolean,
    accessToken: string
  ) => Promise<{ likedByUser: boolean; likeCount: number }>;
  updateSpot: (
    id: string,
    input: UpdateSpotInput,
    accessToken: string
  ) => Promise<Spot>;
  deleteSpot: (id: string, accessToken: string) => Promise<void>;
  fetchMySpotRemovalRequest: (
    spotId: string,
    accessToken: string
  ) => Promise<boolean>;
  submitSpotRemovalRequest: (
    spotId: string,
    reason: SpotRemovalReason,
    details: string,
    accessToken: string
  ) => Promise<void>;
  replaceCreatorUsername: (previousUsername: string, username: string) => void;
  setSpotCommentCount: (spotId: string, commentCount: number) => void;
  hideCreatorSpots: (userId: string) => void;
  clearMySpots: () => void;
  clearLikedSpots: () => void;
  clearReportedSpotIds: () => void;
  reset: () => void;
};

function withReportedSpot(ids: string[], spotId: string): string[] {
  return ids.includes(spotId) ? ids : [...ids, spotId];
}

// Reads stay short, while mutations get enough time for moderation and image upload.
const REQUEST_TIMEOUT_MS = 10_000;
const MUTATION_TIMEOUT_MS = 60_000;
const SAVE_TIMEOUT_ERROR = 'Saving this spot timed out. Please try again.';

const INVALID_SCHOOL_ID_ERROR =
  'A valid school identifier is required to load spots.';
const LOAD_FAILED_ERROR = 'Couldn’t load spots right now.';
const LOAD_TIMEOUT_ERROR = 'Loading spots timed out. Please try again.';
const MY_SPOTS_LOAD_FAILED_ERROR = 'Couldn’t load your spots right now.';
const LIKED_SPOTS_LOAD_FAILED_ERROR = 'Couldn’t load liked spots right now.';

let spotsRequestVersion = 0;
let mySpotsRequestVersion = 0;
let likedSpotsRequestVersion = 0;
let spotLikeMutationVersion = 0;

// React Native serializes an object of this shape as a multipart file part.
type RNFile = { uri: string; name: string; type: string };

// The DOM `FormData` type only accepts `Blob | string`, but React Native
// expects the `{ uri, name, type }` file shape. Cast through `unknown` (never
// `any`) so the multipart part is appended without loosening the file type.
function appendFilePart(form: FormData, field: string, file: RNFile): void {
  form.append(field, file as unknown as Blob);
}

// Run a fetch with an AbortController-based timeout so a hung request rejects
// instead of blocking the store's loading state indefinitely.
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });

    // Keep the timeout active until the complete response body has arrived.
    // Without this, fetch() can resolve on headers while response.json() later
    // hangs forever on a partial server response.
    const responseWithClone = response as unknown as {
      clone?: () => Response;
    };
    if (typeof responseWithClone.clone === 'function') {
      await responseWithClone.clone().arrayBuffer();
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMutationWithTimeout(
  input: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init, MUTATION_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(SAVE_TIMEOUT_ERROR);
    }
    throw error;
  }
}

// Prefer the server-provided `{ error }` message, falling back to the status.
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string;
      reason?: string;
    };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return sanitizeErrorMessage(data.error, LOAD_FAILED_ERROR);
    }
    if (typeof data.reason === 'string' && data.reason.length > 0) {
      return sanitizeErrorMessage(data.reason, LOAD_FAILED_ERROR);
    }
  } catch {
    // Body was not JSON; fall through to the status-based message.
  }

  // 5xx responses come from the transport layer (dev server rebuilding, a
  // paused backend, a flaky tunnel), not our API — which always returns a JSON
  // `{ error }`. Show a friendlier, retryable message instead of a raw status.
  if (response.status >= 500) {
    return 'The server is temporarily unavailable. Please try again.';
  }

  if (response.status === 401) {
    return 'Sign in again to keep going.';
  }

  return `Request failed with status ${response.status}.`;
}

// GET reads are safe to retry. A short, bounded backoff lets transient blips
// (a 5xx from the dev server/tunnel or a dropped connection) self-heal before
// they ever reach the UI. Delays collapse to 0 under Jest so tests stay fast.
const MAX_GET_ATTEMPTS = 3;

function retryDelayMs(attempt: number): number {
  if (process.env.JEST_WORKER_ID !== undefined) {
    return 0;
  }
  return 300 * attempt; // 300ms, then 600ms
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGetWithRetry(
  input: string,
  init: RequestInit,
  maxAttempts: number = MAX_GET_ATTEMPTS
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetchWithTimeout(input, init);

      // Retry only transient (5xx) responses; 4xx are the caller's problem.
      if (response.status >= 500 && attempt < maxAttempts) {
        await wait(retryDelayMs(attempt));
        continue;
      }

      return response;
    } catch (error) {
      // A timeout already waited the full window, so don't retry it. Genuine
      // network errors are worth another try.
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      if (isTimeout || attempt >= maxAttempts) {
        throw error;
      }

      await wait(retryDelayMs(attempt));
    }
  }
}

function toFetchErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return LOAD_TIMEOUT_ERROR;
    }
    if (error.message.length > 0) {
      return error.message;
    }
  }

  return LOAD_FAILED_ERROR;
}

export const useSpotsStore = create<SpotsState>()((set, get) => ({
  spots: [],
  loading: false,
  error: null,
  schoolId: null,
  mySpots: [],
  myLoading: false,
  myError: null,
  likedSpots: [],
  likedLoading: false,
  likedError: null,
  reportedSpotIds: [],

  fetchSpots: async (schoolId: string, accessToken?: string) => {
    const requestVersion = ++spotsRequestVersion;
    const mutationVersion = spotLikeMutationVersion;
    const trimmedSchoolId = schoolId?.trim() ?? '';

    // Blank/whitespace ids never hit the network; expose an error and keep the
    // previously loaded spots unchanged (Req 9.6).
    if (trimmedSchoolId.length === 0) {
      if (requestVersion === spotsRequestVersion) {
        set({ error: INVALID_SCHOOL_ID_ERROR, loading: false });
      }
      return;
    }

    if (requestVersion === spotsRequestVersion) {
      set({ loading: true, error: null });
    }

    try {
      const response = await fetchGetWithRetry(
        getApiUrl(`/api/spots?schoolId=${encodeURIComponent(trimmedSchoolId)}`),
        {
          method: 'GET',
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        }
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { spots?: Spot[] };

      if (
        requestVersion !== spotsRequestVersion ||
        mutationVersion !== spotLikeMutationVersion
      ) {
        if (requestVersion === spotsRequestVersion) {
          set({ loading: false });
        }
        return;
      }

      // An empty result is a success, not an error (Req 9.5).
      set({
        spots: data.spots ?? [],
        schoolId: trimmedSchoolId,
        loading: false,
        error: null,
      });
    } catch (error) {
      // On failure/timeout keep the prior spots and clear loading (Req 9.4).
      if (
        requestVersion !== spotsRequestVersion ||
        mutationVersion !== spotLikeMutationVersion
      ) {
        if (requestVersion === spotsRequestVersion) {
          set({ loading: false });
        }
        return;
      }
      set({ loading: false, error: toFetchErrorMessage(error) });
    }
  },

  addSpot: async (input: NewSpotInput, accessToken: string) => {
    const form = new FormData();
    form.append('schoolId', input.schoolId);
    form.append('name', input.name);
    form.append('description', input.description);
    form.append('latitude', String(input.latitude));
    form.append('longitude', String(input.longitude));

    for (const image of input.images) {
      appendFilePart(form, 'image', {
        uri: image.uri,
        name: image.fileName ?? 'spot.jpg',
        type: image.mimeType ?? 'image/jpeg',
      });
    }

    // Do not set Content-Type: the runtime adds the multipart boundary.
    const response = await fetchMutationWithTimeout(getApiUrl('/api/spots'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as { spot?: Spot };

    if (!data.spot) {
      throw new Error('The server did not return the created spot.');
    }

    captureAnalyticsEvent('spot_created', {
      spot_id: data.spot.id,
      school_id: data.spot.schoolId ?? input.schoolId,
    });

    return data.spot;
  },

  fetchMySpots: async (accessToken: string) => {
    const requestVersion = ++mySpotsRequestVersion;
    const mutationVersion = spotLikeMutationVersion;
    set({ myLoading: true, myError: null });

    try {
      const response = await fetchGetWithRetry(getApiUrl('/api/spots?mine=1'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { spots?: Spot[] };
      if (
        requestVersion !== mySpotsRequestVersion ||
        mutationVersion !== spotLikeMutationVersion
      ) {
        if (requestVersion === mySpotsRequestVersion) {
          set({ myLoading: false });
        }
        return;
      }

      set({ mySpots: data.spots ?? [], myLoading: false, myError: null });
    } catch (error) {
      if (
        requestVersion !== mySpotsRequestVersion ||
        mutationVersion !== spotLikeMutationVersion
      ) {
        if (requestVersion === mySpotsRequestVersion) {
          set({ myLoading: false });
        }
        return;
      }

      // Keep any previously loaded spots and surface the error.
      set({
        myLoading: false,
        myError:
          error instanceof Error && error.message.length > 0
            ? error.message
            : MY_SPOTS_LOAD_FAILED_ERROR,
      });
    }
  },

  fetchLikedSpots: async (accessToken: string) => {
    const requestVersion = ++likedSpotsRequestVersion;
    const mutationVersion = spotLikeMutationVersion;
    set({ likedLoading: true, likedError: null });

    try {
      const response = await fetchGetWithRetry(getApiUrl('/api/spot-likes'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { spots?: Spot[] };
      if (
        requestVersion !== likedSpotsRequestVersion ||
        mutationVersion !== spotLikeMutationVersion
      ) {
        if (requestVersion === likedSpotsRequestVersion) {
          set({ likedLoading: false });
        }
        return;
      }

      set({ likedSpots: data.spots ?? [], likedLoading: false, likedError: null });
    } catch (error) {
      if (
        requestVersion !== likedSpotsRequestVersion ||
        mutationVersion !== spotLikeMutationVersion
      ) {
        if (requestVersion === likedSpotsRequestVersion) {
          set({ likedLoading: false });
        }
        return;
      }

      set({
        likedLoading: false,
        likedError:
          error instanceof Error && error.message.length > 0
            ? error.message
            : LIKED_SPOTS_LOAD_FAILED_ERROR,
      });
    }
  },

  toggleSpotLike: async (id: string, likedByUser: boolean, accessToken: string) => {
    // Invalidate reads when a like mutation starts so an older response cannot
    // overwrite the mutation result when it arrives later.
    spotLikeMutationVersion += 1;

    const response = await fetchMutationWithTimeout(
      getApiUrl(`/api/spot-likes?id=${encodeURIComponent(id)}`),
      {
        method: likedByUser ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as {
      likeCount?: number;
      likedByUser?: boolean;
    };
    const nextLiked = data.likedByUser ?? !likedByUser;
    const nextCount = data.likeCount ?? 0;
    const schoolId =
      get().spots.find((spot) => spot.id === id)?.schoolId ??
      get().mySpots.find((spot) => spot.id === id)?.schoolId ??
      get().likedSpots.find((spot) => spot.id === id)?.schoolId;
    captureAnalyticsEvent(nextLiked ? 'spot_liked' : 'spot_unliked', {
      spot_id: id,
      ...(schoolId ? { school_id: schoolId } : {}),
    });
    spotLikeMutationVersion += 1;

    set((state) => {
      const updateSpot = (spot: Spot): Spot =>
        spot.id === id
          ? { ...spot, likeCount: nextCount, likedByUser: nextLiked }
          : spot;
      const updatedSpots = state.spots.map(updateSpot);
      const updatedMySpots = state.mySpots.map(updateSpot);
      const updatedLikedSpots = state.likedSpots.map(updateSpot);

      if (!nextLiked) {
        return {
          spots: updatedSpots,
          mySpots: updatedMySpots,
          likedSpots: updatedLikedSpots.filter((spot) => spot.id !== id),
        };
      }

      const likedSpot = updatedSpots.find((spot) => spot.id === id);
      return {
        spots: updatedSpots,
        mySpots: updatedMySpots,
        likedSpots:         likedSpot
          ? [
              likedSpot,
              ...updatedLikedSpots.filter((spot) => spot.id !== id),
            ]
          : updatedLikedSpots,
      };
    });

    return { likedByUser: nextLiked, likeCount: nextCount };
  },

  updateSpot: async (id: string, input: UpdateSpotInput, accessToken: string) => {
    const form = new FormData();
    form.append('name', input.name);
    form.append('description', input.description);
    form.append('latitude', String(input.latitude));
    form.append('longitude', String(input.longitude));

    // Only send media when the photo list changed; otherwise the server keeps
    // the existing image_urls.
    if (input.media) {
      const { imageOrder, newAssets } = buildImageOrder(input.media);
      form.append('imageOrder', JSON.stringify(imageOrder));
      for (const image of newAssets) {
        appendFilePart(form, 'image', {
          uri: image.uri,
          name: image.fileName ?? 'spot.jpg',
          type: image.mimeType ?? 'image/jpeg',
        });
      }
    }

    const response = await fetchMutationWithTimeout(
      getApiUrl(`/api/spots?id=${encodeURIComponent(id)}`),
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as { spot?: Spot };
    if (!data.spot) {
      throw new Error('The server did not return the updated spot.');
    }

    const updated = data.spot;

    captureAnalyticsEvent('spot_updated', {
      spot_id: updated.id,
      ...(updated.schoolId ? { school_id: updated.schoolId } : {}),
    });

    // Reflect the change everywhere the spot may appear: the profile list and
    // the currently loaded school map.
    set((state) => ({
      mySpots: state.mySpots.map((spot) => (spot.id === id ? updated : spot)),
      spots: state.spots.map((spot) => (spot.id === id ? updated : spot)),
      likedSpots: state.likedSpots.map((spot) =>
        spot.id === id ? { ...updated, likedByUser: spot.likedByUser } : spot
      ),
    }));

    return updated;
  },

  deleteSpot: async (id: string, accessToken: string) => {
    const response = await fetchWithTimeout(
      getApiUrl(`/api/spots?id=${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const schoolId =
      get().spots.find((spot) => spot.id === id)?.schoolId ??
      get().mySpots.find((spot) => spot.id === id)?.schoolId ??
      get().likedSpots.find((spot) => spot.id === id)?.schoolId;
    captureAnalyticsEvent('spot_deleted', {
      spot_id: id,
      ...(schoolId ? { school_id: schoolId } : {}),
    });

    // Remove the spot globally so it disappears from the profile list and the
    // map immediately.
    set((state) => ({
      mySpots: state.mySpots.filter((spot) => spot.id !== id),
      spots: state.spots.filter((spot) => spot.id !== id),
      likedSpots: state.likedSpots.filter((spot) => spot.id !== id),
    }));
  },

  fetchMySpotRemovalRequest: async (spotId, accessToken) => {
    const response = await fetchGetWithRetry(
      getApiUrl(
        `/api/spot-removal-requests?spotId=${encodeURIComponent(spotId)}`
      ),
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = (await response.json()) as { request?: SpotRemovalRequest | null };
    const submitted = Boolean(data.request);
    if (submitted) {
      set((state) => ({
        reportedSpotIds: withReportedSpot(state.reportedSpotIds, spotId),
      }));
    }
    return submitted;
  },

  submitSpotRemovalRequest: async (spotId, reason, details, accessToken) => {
    const response = await fetchMutationWithTimeout(
      getApiUrl('/api/spot-removal-requests'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spotId, reason, details }),
      }
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    captureAnalyticsEvent('spot_removal_requested', {
      spot_id: spotId,
      reason,
    });

    set((state) => ({
      reportedSpotIds: withReportedSpot(state.reportedSpotIds, spotId),
    }));
  },

  setSpotCommentCount: (spotId, commentCount) => {
    const nextCount = Math.max(0, commentCount);
    const updateSpot = (spot: Spot): Spot =>
      spot.id === spotId ? { ...spot, commentCount: nextCount } : spot;

    set((state) => ({
      spots: state.spots.map(updateSpot),
      mySpots: state.mySpots.map(updateSpot),
      likedSpots: state.likedSpots.map(updateSpot),
    }));
  },

  // Existing spot records cache the public creator name, so update every
  // collection immediately after the profile username has changed.
    replaceCreatorUsername: (previousUsername, username) => {
    if (previousUsername === username) {
      return;
    }

    const replace = (spot: Spot): Spot =>
      spot.creatorUsername === previousUsername
        ? { ...spot, creatorUsername: username }
        : spot;

    set((state) => ({
      spots: state.spots.map(replace),
      mySpots: state.mySpots.map(replace),
      likedSpots: state.likedSpots.map(replace),
    }));
  },

  hideCreatorSpots: (userId) => {
    const keep = (spot: Spot): boolean => spot.creatorUserId !== userId;
    set((state) => ({
      spots: state.spots.filter(keep),
      likedSpots: state.likedSpots.filter(keep),
    }));
  },

  clearMySpots: () => {
    mySpotsRequestVersion += 1;
    set({ mySpots: [], myLoading: false, myError: null });
  },

  clearLikedSpots: () => {
    likedSpotsRequestVersion += 1;
    spotLikeMutationVersion += 1;
    set((state) => ({
      spots: state.spots.map((spot) => ({ ...spot, likedByUser: false })),
      mySpots: state.mySpots.map((spot) => ({ ...spot, likedByUser: false })),
      likedSpots: [],
      likedLoading: false,
      likedError: null,
    }));
  },

  clearReportedSpotIds: () => {
    set({ reportedSpotIds: [] });
  },

  reset: () => {
    spotsRequestVersion += 1;
    mySpotsRequestVersion += 1;
    likedSpotsRequestVersion += 1;
    spotLikeMutationVersion += 1;
    set({
      spots: [],
      loading: false,
      error: null,
      schoolId: null,
      mySpots: [],
      myLoading: false,
      myError: null,
      likedSpots: [],
      likedLoading: false,
      likedError: null,
      reportedSpotIds: [],
    });
  },
}));
