import {
  IMAGE_SANITIZE_ERROR,
  sanitizeSpotImage,
} from '../sanitizeImage';
import {
  CAMERA_MAKE,
  CAPTURE_TIME,
  MINIMAL_JPEG,
  MINIMAL_PNG,
  PNG_TEXT_PAYLOAD,
  SECRET_COMMENT,
  containsAscii,
  jpegHasOrientation,
  jpegWithPrivateMetadata,
  pngWithPrivateMetadata,
  webpWithPrivateMetadata,
} from './imageFixtures';

describe('sanitizeSpotImage', () => {
  it('strips JPEG GPS, camera, timestamp, XMP, and comments while keeping orientation 6', () => {
    const input = jpegWithPrivateMetadata();
    expect(containsAscii(input, CAMERA_MAKE)).toBe(true);
    expect(containsAscii(input, CAPTURE_TIME)).toBe(true);
    expect(containsAscii(input, SECRET_COMMENT)).toBe(true);
    expect(containsAscii(input, 'camera-secret')).toBe(true);
    expect(containsAscii(input, String.fromCharCode(0x88, 0x25))).toBe(true);

    const result = sanitizeSpotImage({ type: 'image/jpeg', bytes: input });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.type).toBe('image/jpeg');
    expect(result.bytes[0]).toBe(0xff);
    expect(result.bytes[1]).toBe(0xd8);
    expect(result.bytes[result.bytes.length - 2]).toBe(0xff);
    expect(result.bytes[result.bytes.length - 1]).toBe(0xd9);
    expect(containsAscii(result.bytes, CAMERA_MAKE)).toBe(false);
    expect(containsAscii(result.bytes, CAPTURE_TIME)).toBe(false);
    expect(containsAscii(result.bytes, SECRET_COMMENT)).toBe(false);
    expect(containsAscii(result.bytes, 'camera-secret')).toBe(false);
    expect(containsAscii(result.bytes, String.fromCharCode(0x88, 0x25))).toBe(
      false
    );
    expect(jpegHasOrientation(result.bytes, 6)).toBe(true);
  });

  it('leaves a JPEG without metadata unchanged', () => {
    const result = sanitizeSpotImage({
      type: 'image/jpeg',
      bytes: MINIMAL_JPEG,
    });
    expect(result).toEqual({ ok: true, type: 'image/jpeg', bytes: MINIMAL_JPEG });
  });

  it('strips PNG eXIf and tEXt chunks while keeping IHDR and IDAT', () => {
    const input = pngWithPrivateMetadata();
    expect(containsAscii(input, 'eXIf')).toBe(true);
    expect(containsAscii(input, PNG_TEXT_PAYLOAD)).toBe(true);

    const result = sanitizeSpotImage({ type: 'image/png', bytes: input });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(containsAscii(result.bytes, 'IHDR')).toBe(true);
    expect(containsAscii(result.bytes, 'IDAT')).toBe(true);
    expect(containsAscii(result.bytes, 'IEND')).toBe(true);
    expect(containsAscii(result.bytes, 'eXIf')).toBe(false);
    expect(containsAscii(result.bytes, 'tEXt')).toBe(false);
    expect(containsAscii(result.bytes, PNG_TEXT_PAYLOAD)).toBe(false);
  });

  it('strips WebP EXIF and XMP chunks and clears VP8X metadata flags', () => {
    const input = webpWithPrivateMetadata();
    expect(containsAscii(input, 'EXIF')).toBe(true);
    expect(containsAscii(input, 'XMP ')).toBe(true);
    expect(containsAscii(input, CAMERA_MAKE)).toBe(true);

    const result = sanitizeSpotImage({ type: 'image/webp', bytes: input });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(containsAscii(result.bytes, 'VP8 ')).toBe(true);
    expect(containsAscii(result.bytes, 'EXIF')).toBe(false);
    expect(containsAscii(result.bytes, 'XMP ')).toBe(false);
    expect(containsAscii(result.bytes, CAMERA_MAKE)).toBe(false);
    expect(containsAscii(result.bytes, 'camera-secret')).toBe(false);
    const vp8x = indexOfAscii(result.bytes, 'VP8X');
    expect(vp8x).toBeGreaterThanOrEqual(0);
    expect(result.bytes[vp8x + 8] & 0x08).toBe(0);
    expect(result.bytes[vp8x + 8] & 0x04).toBe(0);
  });

  it('fails closed on corrupt bytes and type mismatches', () => {
    expect(
      sanitizeSpotImage({
        type: 'image/jpeg',
        bytes: Uint8Array.from([1, 2, 3, 4]),
      })
    ).toEqual({ ok: false, message: IMAGE_SANITIZE_ERROR });
    expect(
      sanitizeSpotImage({
        type: 'image/png',
        bytes: MINIMAL_JPEG,
      })
    ).toEqual({ ok: false, message: IMAGE_SANITIZE_ERROR });
    expect(
      sanitizeSpotImage({
        type: 'image/gif',
        bytes: MINIMAL_PNG,
      })
    ).toEqual({ ok: false, message: IMAGE_SANITIZE_ERROR });
  });
});

function indexOfAscii(bytes: Uint8Array, value: string): number {
  const needle = Uint8Array.from(value, (char) => char.charCodeAt(0));
  for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    let match = true;
    for (let cursor = 0; cursor < needle.length; cursor += 1) {
      if (bytes[index + cursor] !== needle[cursor]) {
        match = false;
        break;
      }
    }
    if (match) {
      return index;
    }
  }
  return -1;
}
