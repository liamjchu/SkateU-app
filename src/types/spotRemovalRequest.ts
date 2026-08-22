export const SPOT_REMOVAL_REASON_VALUES = [
  'no_longer_exists',
  'private_restricted',
  'incorrect_location',
  'dangerous',
  'duplicate',
  'other',
] as const;

export type SpotRemovalReason = (typeof SPOT_REMOVAL_REASON_VALUES)[number];

export type SpotRemovalReasonOption = {
  value: SpotRemovalReason;
  label: string;
};

export type SpotRemovalRequest = {
  id: string;
  spotId: string;
  reason: SpotRemovalReason;
  details: string;
  createdAt: string;
};
