export const CAMERA_MAKE = 'TestCam';
export const CAPTURE_TIME = '2020:01:01 12:00:00';
export const SECRET_COMMENT = 'captured-at-secret';
export const PNG_TEXT_PAYLOAD = 'secret-timestamp';

export const MINIMAL_JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08,
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x00, 0xff, 0xd9,
]);

export const MINIMAL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
  0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

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

function ascii(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index);
  }
  return bytes;
}

function cString(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length + 1);
  bytes.set(ascii(value));
  return bytes;
}

function pngCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = ascii(value);
  if (needle.length === 0 || needle.length > bytes.length) {
    return false;
  }
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let cursor = 0; cursor < needle.length; cursor += 1) {
      if (bytes[index + cursor] !== needle[cursor]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

export function jpegHasOrientation(bytes: Uint8Array, orientation: number): boolean {
  return containsAscii(
    bytes,
    String.fromCharCode(0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00)
  );
}

function buildExifTiff(orientation: number): Uint8Array {
  const make = cString(CAMERA_MAKE);
  const dateTime = cString(CAPTURE_TIME);
  const ifd0Offset = 8;
  const makeOffset = 62;
  const dateOffset = makeOffset + make.length;
  const gpsIfdOffset = dateOffset + dateTime.length;
  const total = gpsIfdOffset + 18;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  view.setUint16(0, 0x4d4d, false);
  view.setUint16(2, 42, false);
  view.setUint32(4, ifd0Offset, false);
  view.setUint16(ifd0Offset, 4, false);

  const writeEntry = (
    offset: number,
    tag: number,
    type: number,
    count: number,
    value: number
  ) => {
    view.setUint16(offset, tag, false);
    view.setUint16(offset + 2, type, false);
    view.setUint32(offset + 4, count, false);
    view.setUint32(offset + 8, value, false);
  };

  writeEntry(10, 0x0112, 3, 1, orientation << 16);
  writeEntry(22, 0x010f, 2, make.length, makeOffset);
  writeEntry(34, 0x0132, 2, dateTime.length, dateOffset);
  writeEntry(46, 0x8825, 4, 1, gpsIfdOffset);
  view.setUint32(58, 0, false);

  bytes.set(make, makeOffset);
  bytes.set(dateTime, dateOffset);

  view.setUint16(gpsIfdOffset, 1, false);
  writeEntry(gpsIfdOffset + 2, 0x0001, 2, 2, 0x4e000000);
  view.setUint32(gpsIfdOffset + 14, 0, false);

  return bytes;
}

function jpegApp1(payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  const segment = new Uint8Array(2 + 2 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (length >> 8) & 0xff;
  segment[3] = length & 0xff;
  segment.set(payload, 4);
  return segment;
}

function jpegCom(text: string): Uint8Array {
  const payload = ascii(text);
  const length = payload.length + 2;
  const segment = new Uint8Array(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xfe;
  segment[2] = (length >> 8) & 0xff;
  segment[3] = length & 0xff;
  segment.set(payload, 4);
  return segment;
}

export function jpegWithPrivateMetadata(): Uint8Array {
  const exifPayload = concatBytes([
    Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]),
    buildExifTiff(6),
  ]);
  const xmpPayload = ascii(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>camera-secret</x:xmpmeta>'
  );
  return concatBytes([
    MINIMAL_JPEG.subarray(0, 20),
    jpegApp1(exifPayload),
    jpegApp1(xmpPayload),
    jpegCom(SECRET_COMMENT),
    MINIMAL_JPEG.subarray(20),
  ]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crcInput = chunk.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, pngCrc(crcInput), false);
  return chunk;
}

export function pngWithPrivateMetadata(): Uint8Array {
  const ihdrEnd = 8 + 12 + 13;
  const text = pngChunk(
    'tEXt',
    concatBytes([ascii('Comment'), Uint8Array.from([0]), ascii(PNG_TEXT_PAYLOAD)])
  );
  const exif = pngChunk('eXIf', buildExifTiff(1));
  return concatBytes([
    MINIMAL_PNG.subarray(0, ihdrEnd),
    text,
    exif,
    MINIMAL_PNG.subarray(ihdrEnd),
  ]);
}

function webpChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const padded = data.length % 2 === 1 ? data.length + 1 : data.length;
  const chunk = new Uint8Array(8 + padded);
  chunk[0] = fourcc.charCodeAt(0);
  chunk[1] = fourcc.charCodeAt(1);
  chunk[2] = fourcc.charCodeAt(2);
  chunk[3] = fourcc.charCodeAt(3);
  chunk[4] = data.length & 0xff;
  chunk[5] = (data.length >>> 8) & 0xff;
  chunk[6] = (data.length >>> 16) & 0xff;
  chunk[7] = (data.length >>> 24) & 0xff;
  chunk.set(data, 8);
  return chunk;
}

export function webpWithPrivateMetadata(): Uint8Array {
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x08;
  const vp8 = Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const payload = concatBytes([
    ascii('WEBP'),
    webpChunk('VP8X', vp8x),
    webpChunk('VP8 ', vp8),
    webpChunk('EXIF', buildExifTiff(1)),
    webpChunk('XMP ', ascii('<x:xmpmeta>camera-secret</x:xmpmeta>')),
  ]);
  const riff = new Uint8Array(8);
  riff.set(ascii('RIFF'));
  riff[4] = payload.length & 0xff;
  riff[5] = (payload.length >>> 8) & 0xff;
  riff[6] = (payload.length >>> 16) & 0xff;
  riff[7] = (payload.length >>> 24) & 0xff;
  return concatBytes([riff, payload]);
}
