import { getSpotSelectionStatus } from '../spotAvailability';

describe('spot selection status', () => {
  it('waits while spots for another campus are still on screen', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: false,
        loadedSchoolId: 'school-a',
        routeSchoolId: 'school-b',
        error: null,
      })
    ).toBe('loading');
  });

  it('waits while the matching campus is still loading', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: true,
        loadedSchoolId: 'school-b',
        routeSchoolId: 'school-b',
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
        loadedSchoolId: 'school-b',
        routeSchoolId: 'school-b',
        error: null,
      })
    ).toBe('ready');
  });

  it('is missing only after this campus finished loading without the spot', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: false,
        loadedSchoolId: 'school-b',
        routeSchoolId: 'school-b',
        error: null,
      })
    ).toBe('missing');
  });

  it('reports a failed lookup when the campus request failed', () => {
    expect(
      getSpotSelectionStatus({
        requestedSpotId: 'spot-b',
        selectedSpot: undefined,
        loading: false,
        loadedSchoolId: 'school-b',
        routeSchoolId: 'school-b',
        error: 'Couldn’t load spots right now.',
      })
    ).toBe('failed');
  });
});
