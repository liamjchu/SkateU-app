import { colors, svgHex } from '../colors';
import images from '../images';

describe('svgHex', () => {
  it('percent-encodes the hash for SVG fills', () => {
    expect(svgHex(colors.brand)).toBe('%232A2224');
    expect(svgHex('#E67A90')).toBe('%23E67A90');
  });
});

describe('images', () => {
  it('exposes the shared lockup and marker assets', () => {
    expect(images.brandLockupCentered).toBeDefined();
    expect(images.brandLockup).toBeDefined();
    expect(images.markerShadow.uri).toContain('marker-shadow.png');
  });
});
