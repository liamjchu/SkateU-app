// Shared client-side rules for the add and edit spot forms. The API validates
// the same constraints server-side; keeping the messages here makes the form
// explain exactly why a save cannot continue.

export const SPOT_NAME_MIN = 1;
export const SPOT_NAME_MAX = 100;
export const SPOT_DESCRIPTION_MIN = 1;
export const SPOT_DESCRIPTION_MAX = 1000;

export type SpotFormErrors = {
  image?: string;
  name?: string;
  description?: string;
};

export function getSpotFormErrors(
  imageUri: string | undefined,
  name: string,
  description: string
): SpotFormErrors {
  const errors: SpotFormErrors = {};
  const nameLength = name.trim().length;
  const descriptionLength = description.trim().length;

  if (!imageUri) {
    errors.image = 'Add a photo to continue.';
  }

  if (nameLength < SPOT_NAME_MIN) {
    errors.name = 'Enter a spot name.';
  } else if (nameLength > SPOT_NAME_MAX) {
    errors.name = `Keep the spot name to ${SPOT_NAME_MAX} characters or fewer.`;
  }

  if (descriptionLength < SPOT_DESCRIPTION_MIN) {
    errors.description = 'Enter a description.';
  } else if (descriptionLength > SPOT_DESCRIPTION_MAX) {
    errors.description = `Keep the description to ${SPOT_DESCRIPTION_MAX} characters or fewer.`;
  }

  return errors;
}

export function isAddSpotFormValid(
  imageUri: string | undefined,
  name: string,
  description: string
): boolean {
  return Object.keys(getSpotFormErrors(imageUri, name, description)).length === 0;
}
