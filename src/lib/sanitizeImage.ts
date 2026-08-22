export const IMAGE_SANITIZE_ERROR =
  'That photo couldn’t be processed. Try another one.';

export type SanitizedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export type SanitizeImageResult =
  | { ok: true; type: SanitizedImageType; bytes: Uint8Array }
  | { ok: false; message: string };

const JPEG_SOI = 0xd8;
const JPEG_EOI = 0xd9;
const JPEG_SOS = 0xda;
const JPEG_COM = 0xfe;
const JPEG_APP0 = 0xe0;
const JPEG_APP1 = 0xe1;
const JPEG_APP13 = 0xed;
const JPEG_RST0 = 0xd0;
const JPEG_RST7 = 0xd7;

const EXIF_HEADER = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
const ORIENTATION_TAG = 0x0112;
const TIFF_SHORT = 3;
const TIFF_LONG = 4;

const PNG_SIGNATURE = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_KEEP = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'bKGD',
  'pHYs',
  'acTL',
  'fcTL',
  'fdAT',
]);

const WEBP_EXIF_FLAG = 0x08;
const WEBP_XMP_FLAG = 0x04;

class CorruptImageError extends Error {
  constructor() {
    super('Corrupt image');
    this.name = 'CorruptImageError';
  }
}

function fail(): never {
  throw new CorruptImageError();
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) {
    total += part.byteLength;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function readU16(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  if (offset + 1 >= bytes.length) {
    fail();
  }
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  if (offset + 3 >= bytes.length) {
    fail();
  }
  if (littleEndian) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array, offset = 0): boolean {
  if (offset + prefix.length > bytes.length) {
    return false;
  }
  for (let index = 0; index < prefix.length; index += 1) {
    if (bytes[offset + index] !== prefix[index]) {
      return false;
    }
  }
  return true;
}

function fourCC(bytes: Uint8Array, offset: number): string {
  if (offset + 3 >= bytes.length) {
    fail();
  }
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === JPEG_SOI;
}

function isPng(bytes: Uint8Array): boolean {
  return startsWith(bytes, PNG_SIGNATURE);
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    fourCC(bytes, 0) === 'RIFF' &&
    fourCC(bytes, 8) === 'WEBP'
  );
}

function magicMatchesType(type: SanitizedImageType, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') {
    return isJpeg(bytes);
  }
  if (type === 'image/png') {
    return isPng(bytes);
  }
  return isWebp(bytes);
}

function readJpegMarker(
  bytes: Uint8Array,
  offset: number
): { type: number; typeOffset: number } {
  if (offset >= bytes.length || bytes[offset] !== 0xff) {
    fail();
  }
  let typeOffset = offset + 1;
  while (typeOffset < bytes.length && bytes[typeOffset] === 0xff) {
    typeOffset += 1;
  }
  if (typeOffset >= bytes.length) {
    fail();
  }
  return { type: bytes[typeOffset], typeOffset };
}

function jpegSegmentEnd(bytes: Uint8Array, typeOffset: number): number {
  const length = readU16(bytes, typeOffset + 1, false);
  if (length < 2) {
    fail();
  }
  const end = typeOffset + 1 + length;
  if (end > bytes.length) {
    fail();
  }
  return end;
}

function jpegSegmentBytes(bytes: Uint8Array, typeOffset: number, end: number): Uint8Array {
  return bytes.subarray(typeOffset - 1, end);
}

function jpegAppPayload(bytes: Uint8Array, typeOffset: number, end: number): Uint8Array {
  return bytes.subarray(typeOffset + 3, end);
}

function isStandaloneJpegMarker(marker: number): boolean {
  return (
    marker === 0x01 ||
    (marker >= JPEG_RST0 && marker <= JPEG_EOI)
  );
}

function readExifOrientation(app1Payload: Uint8Array): number | null {
  if (!startsWith(app1Payload, EXIF_HEADER) || app1Payload.length < 14) {
    return null;
  }

  const tiff = app1Payload.subarray(6);
  const littleEndian = tiff[0] === 0x49 && tiff[1] === 0x49;
  const bigEndian = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!littleEndian && !bigEndian) {
    return null;
  }
  if (readU16(tiff, 2, littleEndian) !== 42) {
    return null;
  }

  const ifd0Offset = readU32(tiff, 4, littleEndian);
  if (ifd0Offset + 2 > tiff.length) {
    return null;
  }
  const entryCount = readU16(tiff, ifd0Offset, littleEndian);
  const entriesStart = ifd0Offset + 2;

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = entriesStart + index * 12;
    if (entryOffset + 12 > tiff.length) {
      return null;
    }
    const tag = readU16(tiff, entryOffset, littleEndian);
    if (tag !== ORIENTATION_TAG) {
      continue;
    }
    const type = readU16(tiff, entryOffset + 2, littleEndian);
    const count = readU32(tiff, entryOffset + 4, littleEndian);
    if (count !== 1) {
      return null;
    }
    if (type === TIFF_SHORT) {
      const value = readU16(tiff, entryOffset + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : null;
    }
    if (type === TIFF_LONG) {
      const value = readU32(tiff, entryOffset + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : null;
    }
    return null;
  }

  return null;
}

function jpegOrientationApp1(orientation: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xe1,
    0x00,
    0x22,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
}

function copyJpegScanToEoi(bytes: Uint8Array, sosTypeOffset: number): Uint8Array {
  const sosHeaderEnd = jpegSegmentEnd(bytes, sosTypeOffset);
  let index = sosHeaderEnd;
  while (index < bytes.length) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    if (index + 1 >= bytes.length) {
      fail();
    }
    const next = bytes[index + 1];
    if (next === 0x00) {
      index += 2;
      continue;
    }
    if (next === 0xff) {
      index += 1;
      continue;
    }
    if (next >= JPEG_RST0 && next <= JPEG_RST7) {
      index += 2;
      continue;
    }
    if (next === JPEG_EOI) {
      return bytes.subarray(sosTypeOffset - 1, index + 2);
    }
    fail();
  }
  fail();
}

function sanitizeJpeg(bytes: Uint8Array): Uint8Array {
  const soi = readJpegMarker(bytes, 0);
  if (soi.type !== JPEG_SOI) {
    fail();
  }

  const app0: Uint8Array[] = [];
  const kept: Uint8Array[] = [];
  let orientation: number | null = null;
  let offset = soi.typeOffset + 1;
  let scan: Uint8Array | null = null;

  while (offset < bytes.length) {
    const marker = readJpegMarker(bytes, offset);
    if (marker.type === JPEG_SOS) {
      scan = copyJpegScanToEoi(bytes, marker.typeOffset);
      break;
    }
    if (isStandaloneJpegMarker(marker.type)) {
      fail();
    }

    const end = jpegSegmentEnd(bytes, marker.typeOffset);
    if (marker.type === JPEG_APP1) {
      const payload = jpegAppPayload(bytes, marker.typeOffset, end);
      const parsed = readExifOrientation(payload);
      if (parsed !== null) {
        orientation = parsed;
      }
    } else if (marker.type === JPEG_APP13 || marker.type === JPEG_COM) {
      // Drop IPTC/Photoshop, comments, and other non-rendering metadata.
    } else if (marker.type === JPEG_APP0) {
      app0.push(jpegSegmentBytes(bytes, marker.typeOffset, end));
    } else {
      kept.push(jpegSegmentBytes(bytes, marker.typeOffset, end));
    }
    offset = end;
  }

  if (scan === null) {
    fail();
  }

  const parts: Uint8Array[] = [bytes.subarray(0, 2), ...app0];
  if (orientation !== null && orientation >= 2 && orientation <= 8) {
    parts.push(jpegOrientationApp1(orientation));
  }
  parts.push(...kept, scan);
  return concatBytes(parts);
}

function sanitizePng(bytes: Uint8Array): Uint8Array {
  if (!isPng(bytes) || bytes.length < 24) {
    fail();
  }

  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset, false);
    const type = fourCC(bytes, offset + 4);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) {
      fail();
    }

    if (!sawIhdr) {
      if (type !== 'IHDR' || length !== 13) {
        fail();
      }
      sawIhdr = true;
    } else if (type === 'IHDR') {
      fail();
    }

    if (type === 'IDAT') {
      sawIdat = true;
    }

    if (type === 'IEND') {
      if (length !== 0) {
        fail();
      }
      sawIend = true;
      kept.push(bytes.subarray(offset, chunkEnd));
      break;
    }

    if (PNG_KEEP.has(type)) {
      kept.push(bytes.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  if (!sawIhdr || !sawIdat || !sawIend) {
    fail();
  }

  return concatBytes(kept);
}

function sanitizeWebp(bytes: Uint8Array): Uint8Array {
  if (!isWebp(bytes) || bytes.length < 20) {
    fail();
  }

  const chunks: { fourcc: string; data: Uint8Array }[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const name = fourCC(bytes, offset);
    const size = readU32(bytes, offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) {
      fail();
    }
    if (name !== 'EXIF' && name !== 'XMP ') {
      chunks.push({ fourcc: name, data: bytes.subarray(dataStart, dataEnd) });
    }
    offset = dataEnd + (size % 2);
  }

  const hasPixels = chunks.some(
    (chunk) =>
      chunk.fourcc === 'VP8 ' ||
      chunk.fourcc === 'VP8L' ||
      chunk.fourcc === 'ANMF'
  );
  if (!hasPixels) {
    fail();
  }

  const rebuilt: Uint8Array[] = [
    Uint8Array.from([0x57, 0x45, 0x42, 0x50]),
  ];
  for (const chunk of chunks) {
    let data = chunk.data;
    if (chunk.fourcc === 'VP8X') {
      if (data.length < 10) {
        fail();
      }
      const patched = Uint8Array.from(data);
      patched[0] = patched[0] & ~WEBP_EXIF_FLAG & ~WEBP_XMP_FLAG;
      data = patched;
    }
    const header = new Uint8Array(8);
    header[0] = chunk.fourcc.charCodeAt(0);
    header[1] = chunk.fourcc.charCodeAt(1);
    header[2] = chunk.fourcc.charCodeAt(2);
    header[3] = chunk.fourcc.charCodeAt(3);
    header[4] = data.length & 0xff;
    header[5] = (data.length >>> 8) & 0xff;
    header[6] = (data.length >>> 16) & 0xff;
    header[7] = (data.length >>> 24) & 0xff;
    rebuilt.push(header, data);
    if (data.length % 2 === 1) {
      rebuilt.push(Uint8Array.from([0]));
    }
  }

  const payload = concatBytes(rebuilt);
  const riff = new Uint8Array(8);
  riff.set([0x52, 0x49, 0x46, 0x46]);
  riff[4] = payload.length & 0xff;
  riff[5] = (payload.length >>> 8) & 0xff;
  riff[6] = (payload.length >>> 16) & 0xff;
  riff[7] = (payload.length >>> 24) & 0xff;
  return concatBytes([riff, payload]);
}

/**
 * Strips GPS, camera, timestamp, and similar metadata containers from a
 * JPEG, PNG, or WebP file. Pixels are not re-encoded. JPEG orientation 2–8
 * is rewritten as a minimal Orientation-only EXIF tag.
 */
export function sanitizeSpotImage(input: {
  type: string;
  bytes: Uint8Array;
}): SanitizeImageResult {
  if (
    input.type !== 'image/jpeg' &&
    input.type !== 'image/png' &&
    input.type !== 'image/webp'
  ) {
    return { ok: false, message: IMAGE_SANITIZE_ERROR };
  }

  try {
    if (!magicMatchesType(input.type, input.bytes)) {
      fail();
    }

    const bytes =
      input.type === 'image/jpeg'
        ? sanitizeJpeg(input.bytes)
        : input.type === 'image/png'
          ? sanitizePng(input.bytes)
          : sanitizeWebp(input.bytes);

    return { ok: true, type: input.type, bytes };
  } catch (error) {
    if (error instanceof CorruptImageError) {
      return { ok: false, message: IMAGE_SANITIZE_ERROR };
    }
    throw error;
  }
}
