import fc from 'fast-check';
import {
    isAddSpotFormValid,
    SPOT_DESCRIPTION_MAX,
    SPOT_DESCRIPTION_MIN,
    SPOT_NAME_MAX,
    SPOT_NAME_MIN,
} from '../../lib/addSpotForm';

// Reference predicate expressed independently of the implementation so the
// property compares behaviour, not code.
function expectedValid(
  imageUri: string | undefined,
  name: string,
  description: string
): boolean {
  const hasImage = typeof imageUri === 'string' && imageUri.length > 0;
  const nameLen = name.trim().length;
  const descLen = description.trim().length;
  return (
    hasImage &&
    nameLen >= SPOT_NAME_MIN &&
    nameLen <= SPOT_NAME_MAX &&
    descLen >= SPOT_DESCRIPTION_MIN &&
    descLen <= SPOT_DESCRIPTION_MAX
  );
}

// A string whose trimmed length lands at an interesting boundary/region for a
// given max: empty, whitespace-only, exactly max, and just over max.
function boundaryTextArb(max: number): fc.Arbitrary<string> {
  return fc.oneof(
    fc.string(), // arbitrary content, includes empty and long
    fc.constantFrom('', ' ', '   ', '\t\n '), // whitespace-only / empty
    fc.string({ minLength: 1, maxLength: max }), // within range
    fc
      .string({ minLength: max, maxLength: max })
      .map((s) => s.padEnd(max, 'a').slice(0, max)), // exactly max
    fc
      .string({ minLength: max + 1, maxLength: max + 20 })
      .map((s) => s.padEnd(max + 1, 'a')), // over max
    // Whitespace padding around real content to exercise trimming.
    fc
      .tuple(fc.string({ minLength: 1, maxLength: max }), fc.nat({ max: 5 }))
      .map(([core, pad]) => `${' '.repeat(pad)}${core}${' '.repeat(pad)}`)
  );
}

// Image presence/absence, including empty-string "selected" (treated as none).
const imageArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.webUrl(),
  fc.string({ minLength: 1 })
);

describe('add-spot save enablement', () => {
  // Feature: global-spots, Property 9: add-spot save enablement matches the
  // validity predicate
  // Validates: Requirements 10.1, 10.2
  it('is enabled iff image selected AND trimmed name in [1,100] AND trimmed description in [1,1000]', () => {
    fc.assert(
      fc.property(
        imageArb,
        boundaryTextArb(SPOT_NAME_MAX),
        boundaryTextArb(SPOT_DESCRIPTION_MAX),
        (imageUri, name, description) => {
          expect(isAddSpotFormValid(imageUri, name, description)).toBe(
            expectedValid(imageUri, name, description)
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts exact boundary lengths and rejects just-over-length values', () => {
    const img = 'file:///spot.jpg';
    const name1 = 'a';
    const name100 = 'a'.repeat(SPOT_NAME_MAX);
    const name101 = 'a'.repeat(SPOT_NAME_MAX + 1);
    const desc1 = 'b';
    const desc1000 = 'b'.repeat(SPOT_DESCRIPTION_MAX);
    const desc1001 = 'b'.repeat(SPOT_DESCRIPTION_MAX + 1);

    expect(isAddSpotFormValid(img, name1, desc1)).toBe(true);
    expect(isAddSpotFormValid(img, name100, desc1000)).toBe(true);
    expect(isAddSpotFormValid(img, name101, desc1000)).toBe(false);
    expect(isAddSpotFormValid(img, name100, desc1001)).toBe(false);
  });

  it('rejects when no image is selected or fields are whitespace-only', () => {
    expect(isAddSpotFormValid(undefined, 'Ledge', 'Nice ledge')).toBe(false);
    expect(isAddSpotFormValid('', 'Ledge', 'Nice ledge')).toBe(false);
    expect(isAddSpotFormValid('file:///x.jpg', '   ', 'Nice ledge')).toBe(false);
    expect(isAddSpotFormValid('file:///x.jpg', 'Ledge', '   ')).toBe(false);
  });
});
