export type SpotSelectionStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'failed';

export function getSpotSelectionStatus(input: {
  requestedSpotId: string | undefined;
  selectedSpot: { id: string } | undefined;
  loading: boolean;
  loadedSchoolId: string | null;
  routeSchoolId: string | undefined;
  error: string | null;
}): SpotSelectionStatus {
  if (!input.requestedSpotId) {
    return 'idle';
  }

  if (input.selectedSpot?.id === input.requestedSpotId) {
    return 'ready';
  }

  const schoolMatches =
    Boolean(input.routeSchoolId) && input.loadedSchoolId === input.routeSchoolId;

  if (!schoolMatches || input.loading) {
    return 'loading';
  }

  if (input.error) {
    return 'failed';
  }

  return 'missing';
}

export const SPOT_LOAD_FAILED_MESSAGE =
  'We couldn’t load this spot. Please try again.';
