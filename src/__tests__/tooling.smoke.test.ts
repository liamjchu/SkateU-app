import fc from 'fast-check';

/**
 * Smoke test confirming the property-based test tooling (Jest + fast-check)
 * is wired up and can execute properties across many generated inputs.
 * Requirements: 11.3, 11.4
 */
describe('property-based test tooling', () => {
  it('runs a property with at least 100 iterations', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a: number, b: number) => {
        return a + b === b + a;
      }),
      { numRuns: 100 }
    );
  });

  it('runs a string property with at least 100 iterations', () => {
    fc.assert(
      fc.property(fc.string(), (value: string) => {
        return value.length >= 0 && [...value].reverse().reverse().join('') === value;
      }),
      { numRuns: 100 }
    );
  });
});
