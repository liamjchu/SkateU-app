import {
  SPOT_REMOVAL_REASON_VALUES,
  type SpotRemovalReason,
  type SpotRemovalReasonOption,
} from '../types/spotRemovalRequest';

export const SPOT_REMOVAL_DETAILS_MAX = 500;
export const SPOT_REMOVAL_REQUESTS_PER_DAY = 10;

export const SPOT_REMOVAL_REASON_OPTIONS: SpotRemovalReasonOption[] = [
  { value: 'no_longer_exists', label: 'Spot no longer exists' },
  { value: 'private_restricted', label: 'Private/restricted area' },
  { value: 'incorrect_location', label: 'Incorrect location' },
  { value: 'dangerous', label: 'Dangerous' },
  { value: 'duplicate', label: 'Duplicate spot' },
  { value: 'other', label: 'Other' },
];

const REASON_LABELS: Record<SpotRemovalReason, string> = {
  no_longer_exists: 'Spot no longer exists',
  private_restricted: 'Private/restricted area',
  incorrect_location: 'Incorrect location',
  dangerous: 'Dangerous',
  duplicate: 'Duplicate spot',
  other: 'Other',
};

export function isSpotRemovalReason(value: unknown): value is SpotRemovalReason {
  return (
    typeof value === 'string' &&
    SPOT_REMOVAL_REASON_VALUES.includes(value as SpotRemovalReason)
  );
}

export function spotRemovalReasonLabel(reason: SpotRemovalReason): string {
  return REASON_LABELS[reason];
}

export function getSpotRemovalDetailsError(details: string): string | null {
  if (details.trim().length > SPOT_REMOVAL_DETAILS_MAX) {
    return `That’s a bit long. Keep it to ${SPOT_REMOVAL_DETAILS_MAX} characters.`;
  }
  return null;
}

export type ValidatedSpotRemovalRequest = {
  spotId: string;
  reason: SpotRemovalReason;
  details: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function validateSpotRemovalRequestBody(
  body: unknown,
  validateSpotId: (value: string | null) => ValidationResult<string>
): ValidationResult<ValidatedSpotRemovalRequest> {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'The request body is malformed.' };
  }

  const record = body as {
    spotId?: unknown;
    reason?: unknown;
    details?: unknown;
  };

  const spotId = typeof record.spotId === 'string' ? record.spotId : '';
  const spotValidation = validateSpotId(spotId);
  if (!spotValidation.ok) {
    return { ok: false, message: spotValidation.message };
  }

  if (!isSpotRemovalReason(record.reason)) {
    return { ok: false, message: 'Choose what’s wrong with this spot.' };
  }

  if (record.details !== undefined && typeof record.details !== 'string') {
    return { ok: false, message: 'The details field is invalid.' };
  }

  const details = typeof record.details === 'string' ? record.details.trim() : '';
  const detailsError = getSpotRemovalDetailsError(details);
  if (detailsError) {
    return { ok: false, message: detailsError };
  }

  return {
    ok: true,
    value: {
      spotId: spotValidation.value,
      reason: record.reason,
      details,
    },
  };
}
