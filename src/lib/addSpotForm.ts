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
    errors.image = 'Add a photo.';
  }

  if (nameLength < SPOT_NAME_MIN) {
    errors.name = 'Add a name.';
  } else if (nameLength > SPOT_NAME_MAX) {
    errors.name = `Keep the name under ${SPOT_NAME_MAX} characters.`;
  }

  if (descriptionLength < SPOT_DESCRIPTION_MIN) {
    errors.description = 'Add a short description.';
  } else if (descriptionLength > SPOT_DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${SPOT_DESCRIPTION_MAX} characters.`;
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

export function getSpotFormMissingSummary(
  imageUri: string | undefined,
  name: string,
  description: string
): string | null {
  const missing: string[] = [];

  if (!imageUri) {
    missing.push('photo');
  }
  if (name.trim().length < SPOT_NAME_MIN) {
    missing.push('name');
  }
  if (description.trim().length < SPOT_DESCRIPTION_MIN) {
    missing.push('description');
  }

  if (missing.length === 0) {
    return null;
  }
  if (missing.length === 3) {
    return 'Needs a name, photo, and description.';
  }
  if (missing.length === 2) {
    return `Needs a ${missing[0]} and ${missing[1]}.`;
  }

  return `Needs a ${missing[0]}.`;
}
