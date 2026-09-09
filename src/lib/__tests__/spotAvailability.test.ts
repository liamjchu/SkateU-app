import { getSpotSelectionStatus } from '../spotAvailability';

describe('spot selection status', () => {
  it('waits while map spots have not been fetched yet', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: false,
        spotsFetchedAt: null,
        error: null,
      })
    ).toBe('loading');
  });

  it('waits while map spots are still loading', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: true,
        spotsFetchedAt: '2026-09-09T00:00:00.000Z',
        error: null,
      })
    ).toBe('loading');
  });

  it('is ready once the requested spot is present', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: { id: 'spot-b' },
        loading: false,
        spotsFetchedAt: '2026-09-09T00:00:00.000Z',
        error: null,
      })
    ).toBe('ready');
  });

  it('is missing only after map spots finished loading without the spot', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: false,
        spotsFetchedAt: '2026-09-09T00:00:00.000Z',
        error: null,
      })
    ).toBe('missing');
  });

  it('reports a failed lookup when the spots request failed', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: false,
        spotsFetchedAt: '2026-09-09T00:00:00.000Z',
        error: 'Couldn’t load spots right now.',
      })
    ).toBe('failed');
  });
});
