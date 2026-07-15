// Pure form-validity predicate for the Add Spot screen. Kept in its own module
// (no React Native imports) so it can be unit/property-tested directly and
// reused by the screen for the Save button's disabled state.
//
// A form is valid iff an image is selected AND the trimmed name is 1–100 chars
// AND the trimmed description is 1–1000 chars (Req 10.1, 10.2).

export const SPOT_NAME_MIN = 1;
export const SPOT_NAME_MAX = 100;
export const SPOT_DESCRIPTION_MIN = 1;
export const SPOT_DESCRIPTION_MAX = 1000;

export function isAddSpotFormValid(
  imageUri: string | undefined,
  name: string,
  description: string
): boolean {
  const hasImage = typeof imageUri === 'string' && imageUri.length > 0;

  const nameLength = name.trim().length;
  const descriptionLength = description.trim().length;

  return (
    hasImage &&
    nameLength >= SPOT_NAME_MIN &&
    nameLength <= SPOT_NAME_MAX &&
    descriptionLength >= SPOT_DESCRIPTION_MIN &&
    descriptionLength <= SPOT_DESCRIPTION_MAX
  );
}
