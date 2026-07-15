import fc from 'fast-check';
import type { NewSpotInput, Spot } from '../../types/spot';
import { useSpotsStore } from '../spotsStore';

// The AsyncStorage native module is unavailable under Jest; use the library's
// official in-memory mock so we can assert the store never writes to it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

// The store now resolves request URLs through getApiUrl(), which requires an
// absolute base URL on native platforms. Provide one so the mocked fetch is
// still reached (the value itself is irrelevant since fetch is mocked).
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8081';

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
  schoolName: fc.string(),
  creatorUsername: fc.option(fc.string(), { nil: null }),
  createdAt: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
  updatedAt: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
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
        schoolName: 'CU Boulder',
        creatorUsername: 'skater_jane',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
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
      schoolName: 'Some School',
      creatorUsername: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
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

// A fully-populated Spot for state-mutation tests (all required fields set).
function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'spot-1',
    name: 'Rail',
    description: 'A rail',
    latitude: 10,
    longitude: 20,
    imageUris: [],
    city: 'Austin',
    state: 'TX',
    schoolName: 'UT Austin',
    creatorUsername: 'skater_jane',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('spotsStore.fetchMySpots', () => {
  it('loads the user spots and sends the bearer token to the mine endpoint', async () => {
    fetchMock.mockResolvedValue(mockResponse({ spots: [makeSpot({ id: 'a' })] }));

    await useSpotsStore.getState().fetchMySpots('token-abc');

    const state = useSpotsStore.getState();
    expect(state.mySpots).toHaveLength(1);
    expect(state.myLoading).toBe(false);
    expect(state.myError).toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('mine=1');
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization
    ).toBe('Bearer token-abc');
  });

  it('sets myError and clears loading when the request fails', async () => {
    useSpotsStore.setState({ mySpots: [makeSpot({ id: 'existing' })] });
    // 401 is not retried, so this is a single call.
    fetchMock.mockResolvedValue(
      mockResponse({ error: 'Unauthorized' }, { ok: false, status: 401 })
    );

    await useSpotsStore.getState().fetchMySpots('token-abc');

    const state = useSpotsStore.getState();
    expect(state.myError).toBe('Unauthorized');
    expect(state.myLoading).toBe(false);
    // Prior spots are preserved on failure.
    expect(state.mySpots).toEqual([makeSpot({ id: 'existing' })]);
  });
});

describe('spotsStore.updateSpot', () => {
  it('replaces the spot in both mySpots and spots on success', async () => {
    useSpotsStore.setState({
      mySpots: [makeSpot({ id: 'a', name: 'Old' }), makeSpot({ id: 'b' })],
      spots: [makeSpot({ id: 'a', name: 'Old' })],
    });
    const updated = makeSpot({ id: 'a', name: 'New name' });
    fetchMock.mockResolvedValue(mockResponse({ spot: updated }));

    const result = await useSpotsStore.getState().updateSpot(
      'a',
      { name: 'New name', description: 'A rail', latitude: 10, longitude: 20 },
      'token-abc'
    );

    expect(result.name).toBe('New name');
    const state = useSpotsStore.getState();
    expect(state.mySpots.find((s) => s.id === 'a')?.name).toBe('New name');
    expect(state.spots.find((s) => s.id === 'a')?.name).toBe('New name');
    // The untouched spot is left alone.
    expect(state.mySpots.find((s) => s.id === 'b')?.name).toBe('Rail');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('id=a');
    expect(init?.method).toBe('PATCH');
  });

  it('throws the server error and leaves state unchanged on failure', async () => {
    const seeded = [makeSpot({ id: 'a', name: 'Old' })];
    useSpotsStore.setState({ mySpots: seeded, spots: seeded });
    fetchMock.mockResolvedValue(
      mockResponse(
        { error: 'You can only edit spots you created.' },
        { ok: false, status: 403 }
      )
    );

    await expect(
      useSpotsStore.getState().updateSpot(
        'a',
        { name: 'New', description: 'A rail', latitude: 10, longitude: 20 },
        'token-abc'
      )
    ).rejects.toThrow('You can only edit spots you created.');

    const state = useSpotsStore.getState();
    expect(state.mySpots.find((s) => s.id === 'a')?.name).toBe('Old');
  });
});

describe('spotsStore.deleteSpot', () => {
  it('removes the spot from both mySpots and spots on success', async () => {
    useSpotsStore.setState({
      mySpots: [makeSpot({ id: 'a' }), makeSpot({ id: 'b' })],
      spots: [makeSpot({ id: 'a' }), makeSpot({ id: 'b' })],
    });
    fetchMock.mockResolvedValue(mockResponse({ success: true }));

    await useSpotsStore.getState().deleteSpot('a', 'token-abc');

    const state = useSpotsStore.getState();
    expect(state.mySpots.map((s) => s.id)).toEqual(['b']);
    expect(state.spots.map((s) => s.id)).toEqual(['b']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('id=a');
    expect(init?.method).toBe('DELETE');
  });

  it('throws and keeps the spot when the server rejects the delete', async () => {
    useSpotsStore.setState({
      mySpots: [makeSpot({ id: 'a' })],
      spots: [makeSpot({ id: 'a' })],
    });
    fetchMock.mockResolvedValue(
      mockResponse(
        { error: 'You can only delete spots you created.' },
        { ok: false, status: 403 }
      )
    );

    await expect(
      useSpotsStore.getState().deleteSpot('a', 'token-abc')
    ).rejects.toThrow('You can only delete spots you created.');

    expect(useSpotsStore.getState().mySpots.map((s) => s.id)).toEqual(['a']);
  });
});

describe('spotsStore GET retry behaviour', () => {
  it('retries a transient 5xx and then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 503 }))
      .mockResolvedValueOnce(mockResponse({ spots: [makeSpot({ id: 'a' })] }));

    await useSpotsStore.getState().fetchSpots('school-1');

    const state = useSpotsStore.getState();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.spots).toHaveLength(1);
    expect(state.error).toBeNull();
  });

  it('retries a network error and then succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(rejectingFetch('network'))
      .mockResolvedValueOnce(mockResponse({ spots: [] }));

    await useSpotsStore.getState().fetchSpots('school-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useSpotsStore.getState().error).toBeNull();
  });

  it('does not retry a 4xx response', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ error: 'bad request' }, { ok: false, status: 400 })
    );

    await useSpotsStore.getState().fetchSpots('school-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useSpotsStore.getState().error).toBe('bad request');
  });

  it('does not retry a timeout (abort)', async () => {
    fetchMock.mockRejectedValue(rejectingFetch('abort'));

    await useSpotsStore.getState().fetchSpots('school-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useSpotsStore.getState().error).toMatch(/timed out/i);
  });

  it('gives up after the maximum attempts on a persistent 5xx', async () => {
    fetchMock.mockResolvedValue(mockResponse({}, { ok: false, status: 503 }));

    await useSpotsStore.getState().fetchSpots('school-1');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useSpotsStore.getState().error).toMatch(/temporarily unavailable/i);
  });
});
