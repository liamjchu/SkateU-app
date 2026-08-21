import fc from 'fast-check';
import {
    getSpotFormMissingSummary,
    isAddSpotFormValid,
    SPOT_DESCRIPTION_MAX,
    SPOT_DESCRIPTION_MIN,
    SPOT_IMAGE_MAX,
    SPOT_NAME_MAX,
    SPOT_NAME_MIN,
} from '../../lib/addSpotForm';

// Reference predicate expressed independently of the implementation so the
// property compares behaviour, not code.
function expectedValid(
  photoCount: number,
  name: string,
  description: string
): boolean {
  const nameLen = name.trim().length;
  const descLen = description.trim().length;
  return (
    photoCount >= 1 &&
    photoCount <= SPOT_IMAGE_MAX &&
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

const photoCountArb: fc.Arbitrary<number> = fc.integer({
  min: 0,
  max: SPOT_IMAGE_MAX + 2,
});

describe('add-spot save enablement', () => {
  // Feature: global-spots, Property 9: add-spot save enablement matches the
  // validity predicate
  // Validates: Requirements 10.1, 10.2
  it('is enabled iff at least one photo AND trimmed name in [1,100] AND trimmed description in [1,1000]', () => {
    fc.assert(
      fc.property(
        photoCountArb,
        boundaryTextArb(SPOT_NAME_MAX),
        boundaryTextArb(SPOT_DESCRIPTION_MAX),
        (photoCount, name, description) => {
          expect(isAddSpotFormValid(photoCount, name, description)).toBe(
            expectedValid(photoCount, name, description)
          );
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts exact boundary lengths and rejects just-over-length values', () => {
    const name1 = 'a';
    const name100 = 'a'.repeat(SPOT_NAME_MAX);
    const name101 = 'a'.repeat(SPOT_NAME_MAX + 1);
    const desc1 = 'b';
    const desc1000 = 'b'.repeat(SPOT_DESCRIPTION_MAX);
    const desc1001 = 'b'.repeat(SPOT_DESCRIPTION_MAX + 1);

    expect(isAddSpotFormValid(1, name1, desc1)).toBe(true);
    expect(isAddSpotFormValid(1, name100, desc1000)).toBe(true);
    expect(isAddSpotFormValid(SPOT_IMAGE_MAX, name100, desc1000)).toBe(true);
    expect(isAddSpotFormValid(1, name101, desc1000)).toBe(false);
    expect(isAddSpotFormValid(1, name100, desc1001)).toBe(false);
    expect(isAddSpotFormValid(SPOT_IMAGE_MAX + 1, name100, desc1000)).toBe(false);
  });

  it('rejects when no photo is selected or fields are whitespace-only', () => {
    expect(isAddSpotFormValid(0, 'Ledge', 'Nice ledge')).toBe(false);
    expect(isAddSpotFormValid(1, '   ', 'Nice ledge')).toBe(false);
    expect(isAddSpotFormValid(1, 'Ledge', '   ')).toBe(false);
  });
});

describe('add-spot missing summary', () => {
  it('names only the fields that are actually wrong', () => {
    expect(getSpotFormMissingSummary(1, '', 'Nice ledge')).toBe(
      'Still needs a name.'
    );
    expect(getSpotFormMissingSummary(1, 'Ledge', '')).toBe(
      'Still needs a description.'
    );
    expect(getSpotFormMissingSummary(0, 'Ledge', 'Nice ledge')).toBe(
      'Still needs a photo.'
    );
    expect(getSpotFormMissingSummary(0, '', 'Nice ledge')).toBe(
      'Still needs a name and a photo.'
    );
    expect(getSpotFormMissingSummary(0, '', '')).toBe(
      'Still needs a name, a photo, and a description.'
    );
    expect(getSpotFormMissingSummary(1, '', '')).toBe(
      'Still needs a name and a description.'
    );
    expect(
      getSpotFormMissingSummary(1, 'a'.repeat(SPOT_NAME_MAX + 1), 'Nice ledge')
    ).toBe('That name is too long.');
    expect(
      getSpotFormMissingSummary(SPOT_IMAGE_MAX + 1, 'Ledge', 'Nice ledge')
    ).toBe(`You can add up to ${SPOT_IMAGE_MAX} photos.`);
    expect(getSpotFormMissingSummary(1, 'Ledge', 'Nice ledge')).toBe(
      null
    );
    expect(
      getSpotFormMissingSummary(
        1,
        'a'.repeat(SPOT_NAME_MAX + 1),
        'b'.repeat(SPOT_DESCRIPTION_MAX + 1)
      )
    ).toBe('Those name and description are too long.');
    expect(
      getSpotFormMissingSummary(1, 'Ledge', 'b'.repeat(SPOT_DESCRIPTION_MAX + 1))
    ).toBe('That description is too long.');
  });
});
