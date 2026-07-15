import { create } from 'zustand';
import { getApiUrl } from '../lib/api';
import type { NewSpotInput, Spot, UpdateSpotInput } from '../types/spot';


type SpotsState = {
  spots: Spot[];
  loading: boolean;
  error: string | null;
  schoolId: string | null;
  // The signed-in user's own spots (across all schools), for the profile page.
  mySpots: Spot[];
  myLoading: boolean;
  myError: string | null;
  fetchSpots: (schoolId: string) => Promise<void>;
  addSpot: (input: NewSpotInput, accessToken: string) => Promise<Spot>;
  fetchMySpots: (accessToken: string) => Promise<void>;
  updateSpot: (
    id: string,
    input: UpdateSpotInput,
    accessToken: string
  ) => Promise<Spot>;
  deleteSpot: (id: string, accessToken: string) => Promise<void>;
  reset: () => void;
};

// Both requests must complete or time out within 10 seconds (Req 9.2, 10.3).
const REQUEST_TIMEOUT_MS = 10_000;

const INVALID_SCHOOL_ID_ERROR =
  'A valid school identifier is required to load spots.';
const LOAD_FAILED_ERROR = 'Unable to load spots right now.';
const LOAD_TIMEOUT_ERROR = 'Loading spots timed out. Please try again.';
const MY_SPOTS_LOAD_FAILED_ERROR = 'Unable to load your spots right now.';

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
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Prefer the server-provided `{ error }` message, falling back to the status.
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
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

export const useSpotsStore = create<SpotsState>()((set) => ({
  spots: [],
  loading: false,
  error: null,
  schoolId: null,
  mySpots: [],
  myLoading: false,
  myError: null,

  fetchSpots: async (schoolId: string) => {
    const trimmedSchoolId = schoolId?.trim() ?? '';

    // Blank/whitespace ids never hit the network; expose an error and keep the
    // previously loaded spots unchanged (Req 9.6).
    if (trimmedSchoolId.length === 0) {
      set({ error: INVALID_SCHOOL_ID_ERROR, loading: false });
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await fetchGetWithRetry(
        getApiUrl(`/api/spots?schoolId=${encodeURIComponent(trimmedSchoolId)}`),
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as { spots?: Spot[] };

      // An empty result is a success, not an error (Req 9.5).
      set({
        spots: data.spots ?? [],
        schoolId: trimmedSchoolId,
        loading: false,
        error: null,
      });
    } catch (error) {
      // On failure/timeout keep the prior spots and clear loading (Req 9.4).
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

    if (input.imageUri) {
      appendFilePart(form, 'image', {
        uri: input.imageUri,
        name: 'spot.jpg',
        type: 'image/jpeg',
      });
    }

    // Do not set Content-Type: the runtime adds the multipart boundary.
    const response = await fetchWithTimeout(getApiUrl('/api/spots'), {
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

    return data.spot;
  },

  fetchMySpots: async (accessToken: string) => {
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
      set({ mySpots: data.spots ?? [], myLoading: false, myError: null });
    } catch (error) {
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

  updateSpot: async (id: string, input: UpdateSpotInput, accessToken: string) => {
    const form = new FormData();
    form.append('name', input.name);
    form.append('description', input.description);
    form.append('latitude', String(input.latitude));
    form.append('longitude', String(input.longitude));

    // Only send an image part when the user picked a new one; otherwise the
    // server keeps the existing image.
    if (input.imageUri) {
      appendFilePart(form, 'image', {
        uri: input.imageUri,
        name: 'spot.jpg',
        type: 'image/jpeg',
      });
    }

    const response = await fetchWithTimeout(
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

    // Reflect the change everywhere the spot may appear: the profile list and
    // the currently loaded school map.
    set((state) => ({
      mySpots: state.mySpots.map((spot) => (spot.id === id ? updated : spot)),
      spots: state.spots.map((spot) => (spot.id === id ? updated : spot)),
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

    // Remove the spot globally so it disappears from the profile list and the
    // map immediately.
    set((state) => ({
      mySpots: state.mySpots.filter((spot) => spot.id !== id),
      spots: state.spots.filter((spot) => spot.id !== id),
    }));
  },

  reset: () => {
    set({
      spots: [],
      loading: false,
      error: null,
      schoolId: null,
      mySpots: [],
      myLoading: false,
      myError: null,
    });
  },
}));
