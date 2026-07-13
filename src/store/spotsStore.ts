import { create } from 'zustand';
import type { NewSpotInput, Spot } from '../types/spot';

type SpotsState = {
  spots: Spot[];
  loading: boolean;
  error: string | null;
  schoolId: string | null;
  fetchSpots: (schoolId: string) => Promise<void>;
  addSpot: (input: NewSpotInput, accessToken: string) => Promise<Spot>;
  reset: () => void;
};

// Both requests must complete or time out within 10 seconds (Req 9.2, 10.3).
const REQUEST_TIMEOUT_MS = 10_000;

const INVALID_SCHOOL_ID_ERROR =
  'A valid school identifier is required to load spots.';
const LOAD_FAILED_ERROR = 'Unable to load spots right now.';
const LOAD_TIMEOUT_ERROR = 'Loading spots timed out. Please try again.';

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

  return `Request failed with status ${response.status}.`;
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
      const response = await fetchWithTimeout(
        `/api/spots?schoolId=${encodeURIComponent(trimmedSchoolId)}`,
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
    const response = await fetchWithTimeout('/api/spots', {
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

  reset: () => {
    set({ spots: [], loading: false, error: null, schoolId: null });
  },
}));
