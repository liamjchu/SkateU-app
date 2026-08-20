// Shared client-side rules for the add and edit spot forms. The API validates
// the same constraints server-side; keeping the messages here makes the form
// explain exactly why a save cannot continue.

export const SPOT_NAME_MIN = 1;
export const SPOT_NAME_MAX = 100;
export const SPOT_DESCRIPTION_MIN = 1;
export const SPOT_DESCRIPTION_MAX = 1000;
export const SPOT_IMAGE_MIN = 1;
export const SPOT_IMAGE_MAX = 3;

export type SpotFormErrors = {
  image?: string;
  name?: string;
  description?: string;
};

export function getSpotFormErrors(
  photoCount: number,
  name: string,
  description: string
): SpotFormErrors {
  const errors: SpotFormErrors = {};
  const nameLength = name.trim().length;
  const descriptionLength = description.trim().length;

  if (photoCount < SPOT_IMAGE_MIN) {
    errors.image = 'Still needs a photo.';
  } else if (photoCount > SPOT_IMAGE_MAX) {
    errors.image = `That’s the max — ${SPOT_IMAGE_MAX} photos.`;
  }

  if (nameLength < SPOT_NAME_MIN) {
    errors.name = 'Still needs a name.';
  } else if (nameLength > SPOT_NAME_MAX) {
    errors.name = 'That name’s a bit long.';
  }

  if (descriptionLength < SPOT_DESCRIPTION_MIN) {
    errors.description = 'Still needs a description.';
  } else if (descriptionLength > SPOT_DESCRIPTION_MAX) {
    errors.description = 'That description’s a bit long.';
  }

  return errors;
}

export function isAddSpotFormValid(
  photoCount: number,
  name: string,
  description: string
): boolean {
  return Object.keys(getSpotFormErrors(photoCount, name, description)).length === 0;
}

function joinCasualList(items: string[]): string {
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function joinWithArticles(items: string[]): string {
  const withArticles = items.map((item) => `a ${item}`);
  return joinCasualList(withArticles);
}

export function getSpotFormMissingSummary(
  photoCount: number,
  name: string,
  description: string
): string | null {
  const errors = getSpotFormErrors(photoCount, name, description);
  const messages = [errors.name, errors.image, errors.description].filter(
    (message): message is string => Boolean(message)
  );

  if (messages.length === 0) {
    return null;
  }
  if (messages.length === 1) {
    return messages[0];
  }

  const missing: string[] = [];
  if (errors.name && name.trim().length < SPOT_NAME_MIN) {
    missing.push('name');
  }
  if (errors.image && photoCount < SPOT_IMAGE_MIN) {
    missing.push('photo');
  }
  if (errors.description && description.trim().length < SPOT_DESCRIPTION_MIN) {
    missing.push('description');
  }

  const tooLong: string[] = [];
  if (errors.name && name.trim().length > SPOT_NAME_MAX) {
    tooLong.push('name');
  }
  if (
    errors.description &&
    description.trim().length > SPOT_DESCRIPTION_MAX
  ) {
    tooLong.push('description');
  }

  if (tooLong.length === 0 && missing.length > 0) {
    return `Still needs ${joinWithArticles(missing)}.`;
  }
  if (missing.length === 0 && tooLong.length === 1) {
    return `That ${tooLong[0]}’s a bit long.`;
  }
  if (missing.length === 0 && tooLong.length > 1) {
    return `That ${joinCasualList(tooLong)} are a bit long.`;
  }

  return messages.join(' ');
}
