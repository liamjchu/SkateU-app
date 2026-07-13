import fc from 'fast-check';
import type { NewSpotInput, Spot } from '../../types/spot';
import { useSpotsStore } from '../spotsStore';

// The AsyncStorage native module is unavailable under Jest; use the library's
// official in-memory mock so we can assert the store never writes to it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

// Build a minimal Response-like object for the mocked fetch. Cast through
// `unknown` (never `any`) so only the fields the store reads are provided.
function mockResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number }
): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

// A fetch that rejects, modelling a network error (name 'Error') or a
// timeout/abort (name 'AbortError').
function rejectingFetch(kind: 'network' | 'abort'): Error {
  const error = new Error(kind === 'abort' ? 'Aborted' : 'Network request failed');
  error.name = kind === 'abort' ? 'AbortError' : 'Error';
  return error;
}

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  useSpotsStore.getState().reset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Generates a plausible Spot record (schoolId omitted; it is optional).
const spotArb: fc.Arbitrary<Spot> = fc.record({
  id: fc.string({ minLength: 1 }),
  name: fc.string(),
  description: fc.string(),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
  imageUris: fc.array(fc.webUrl()),
  city: fc.string(),
  state: fc.string(),
});

// Whitespace-only strings, including the empty string.
const blankSchoolIdArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { maxLength: 12 })
  .map((chars) => chars.join(''));

describe('spotsStore', () => {
  // Feature: global-spots, Property 7: a failed fetch preserves previously
  // loaded spots
  // Validates: Requirements 9.4
  it('preserves previously loaded spots when a fetch fails or times out', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(spotArb),
        fc.constantFrom<'network' | 'abort' | 'non-ok'>('network', 'abort', 'non-ok'),
        fc.string({ minLength: 1 }).filter((value) => value.trim().length > 0),
        async (priorSpots, failureKind, schoolId) => {
          useSpotsStore.setState({
            spots: priorSpots,
            loading: false,
            error: null,
            schoolId: 'prior-school',
          });

          if (failureKind === 'non-ok') {
            fetchMock.mockResolvedValue(
              mockResponse({ error: 'boom' }, { ok: false, status: 500 })
            );
          } else {
            fetchMock.mockRejectedValue(rejectingFetch(failureKind));
          }

          await useSpotsStore.getState().fetchSpots(schoolId);

          const state = useSpotsStore.getState();
          expect(state.error).not.toBeNull();
          expect(state.loading).toBe(false);
          expect(state.spots).toEqual(priorSpots);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: global-spots, Property 8: blank schoolId is rejected without a
  // fetch
  // Validates: Requirements 9.6
  it('rejects a blank schoolId without initiating a fetch', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(spotArb), blankSchoolIdArb, async (priorSpots, blankId) => {
        fetchMock.mockReset();
        useSpotsStore.setState({
          spots: priorSpots,
          loading: false,
          error: null,
          schoolId: 'prior-school',
        });

        await useSpotsStore.getState().fetchSpots(blankId);

        const state = useSpotsStore.getState();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(state.error).not.toBeNull();
        expect(state.loading).toBe(false);
        expect(state.spots).toEqual(priorSpots);
      }),
      { numRuns: 100 }
    );
  });

  it('loads spots and clears loading on a successful fetch', async () => {
    const spots: Spot[] = [
      {
        id: 'spot-1',
        name: 'Ledge',
        description: 'Smooth granite ledge',
        latitude: 40,
        longitude: -105,
        imageUris: ['https://example.com/a.jpg'],
        city: 'Boulder',
        state: 'CO',
      },
    ];
    fetchMock.mockResolvedValue(mockResponse({ spots }));

    await useSpotsStore.getState().fetchSpots('school-1');

    const state = useSpotsStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.spots).toEqual(spots);
    expect(state.schoolId).toBe('school-1');
  });

  it('clears loading when a fetch times out', async () => {
    fetchMock.mockRejectedValue(rejectingFetch('abort'));

    await useSpotsStore.getState().fetchSpots('school-1');

    const state = useSpotsStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).not.toBeNull();
  });

  it('exposes an empty collection with no error when zero records are returned', async () => {
    fetchMock.mockResolvedValue(mockResponse({ spots: [] }));

    await useSpotsStore.getState().fetchSpots('school-1');

    const state = useSpotsStore.getState();
    expect(state.spots).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('does not persist spots to AsyncStorage on fetch or add', async () => {
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');

    fetchMock.mockResolvedValue(mockResponse({ spots: [] }));
    await useSpotsStore.getState().fetchSpots('school-1');

    const created: Spot = {
      id: 'spot-1',
      name: 'Rail',
      description: 'Round rail',
      latitude: 1,
      longitude: 2,
      imageUris: [],
      city: 'City',
      state: 'ST',
    };
    fetchMock.mockResolvedValue(mockResponse({ spot: created }, { status: 201 }));

    const input: NewSpotInput = {
      schoolId: 'school-1',
      name: 'Rail',
      description: 'Round rail',
      latitude: 1,
      longitude: 2,
    };
    const result = await useSpotsStore.getState().addSpot(input, 'token-123');

    expect(result).toEqual(created);
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
