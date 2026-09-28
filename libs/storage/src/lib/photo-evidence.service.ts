import * as crypto from 'crypto';

export type ExifGpsCoordinates = {
  latitude: number;
  longitude: number;
};

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const JPEG_SOI_0 = 0xff;
const JPEG_SOI_1 = 0xd8;
const APP1_MARKER = 0xe1;
const GPS_IFD_POINTER_TAG = 0x8825;
const GPS_LAT_REF_TAG = 0x0001;
const GPS_LAT_TAG = 0x0002;
const GPS_LON_REF_TAG = 0x0003;
const GPS_LON_TAG = 0x0004;
const TYPE_ASCII = 2;
const TYPE_RATIONAL = 5;

export const sha256Hex = (buffer: Buffer): string =>
  crypto.createHash('sha256').update(buffer).digest('hex');

type TiffContext = {
  littleEndian: boolean;
  base: number;
};

const readUInt16 = (
  buffer: Buffer,
  offset: number,
  littleEndian: boolean
): number | null => {
  if (offset < 0 || offset + 2 > buffer.length) {
    return null;
  }
  return littleEndian
    ? buffer.readUInt16LE(offset)
    : buffer.readUInt16BE(offset);
};

const readUInt32 = (
  buffer: Buffer,
  offset: number,
  littleEndian: boolean
): number | null => {
  if (offset < 0 || offset + 4 > buffer.length) {
    return null;
  }
  return littleEndian
    ? buffer.readUInt32LE(offset)
    : buffer.readUInt32BE(offset);
};

const readAscii = (
  buffer: Buffer,
  context: TiffContext,
  type: number,
  count: number,
  valueOffset: number
): string | null => {
  if (type !== TYPE_ASCII || count < 1 || count > 256) {
    return null;
  }
  if (count <= 4) {
    const raw = Buffer.alloc(4);
    if (context.littleEndian) {
      raw.writeUInt32LE(valueOffset);
    } else {
      raw.writeUInt32BE(valueOffset);
    }
    return raw.subarray(0, count).toString('ascii').replace(/\0/g, '');
  }
  const start = context.base + valueOffset;
  if (start < 0 || start + count > buffer.length) {
    return null;
  }
  return buffer
    .subarray(start, start + count)
    .toString('ascii')
    .replace(/\0/g, '');
};

const readRational = (
  buffer: Buffer,
  context: TiffContext,
  valueOffset: number
): number | null => {
  const start = context.base + valueOffset;
  const numerator = readUInt32(buffer, start, context.littleEndian);
  const denominator = readUInt32(buffer, start + 4, context.littleEndian);
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

const readIfdEntries = (
  buffer: Buffer,
  context: TiffContext,
  ifdOffset: number
): Array<{
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
}> | null => {
  const start = context.base + ifdOffset;
  const entryCount = readUInt16(buffer, start, context.littleEndian);
  if (entryCount === null || entryCount > 256) {
    return null;
  }
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    const offset = start + 2 + index * 12;
    const tag = readUInt16(buffer, offset, context.littleEndian);
    const type = readUInt16(buffer, offset + 2, context.littleEndian);
    const count = readUInt32(buffer, offset + 4, context.littleEndian);
    const valueOffset = readUInt32(buffer, offset + 8, context.littleEndian);
    if (
      tag === null ||
      type === null ||
      count === null ||
      valueOffset === null
    ) {
      return null;
    }
    entries.push({ tag, type, count, valueOffset });
  }
  return entries;
};

const rationalTripletToDecimal = (
  buffer: Buffer,
  context: TiffContext,
  entry: { type: number; count: number; valueOffset: number }
): number | null => {
  if (entry.type !== TYPE_RATIONAL || entry.count !== 3) {
    return null;
  }
  const degrees = readRational(buffer, context, entry.valueOffset);
  const minutes = readRational(buffer, context, entry.valueOffset + 8);
  const seconds = readRational(buffer, context, entry.valueOffset + 16);
  if (degrees === null || minutes === null || seconds === null) {
    return null;
  }
  return degrees + minutes / 60 + seconds / 3600;
};

const parseGpsIfd = (
  buffer: Buffer,
  context: TiffContext,
  ifdOffset: number
): ExifGpsCoordinates | null => {
  const entries = readIfdEntries(buffer, context, ifdOffset);
  if (!entries) {
    return null;
  }
  const byTag = new Map(entries.map((entry) => [entry.tag, entry]));
  const latRef = byTag.get(GPS_LAT_REF_TAG);
  const lat = byTag.get(GPS_LAT_TAG);
  const lonRef = byTag.get(GPS_LON_REF_TAG);
  const lon = byTag.get(GPS_LON_TAG);
  if (!latRef || !lat || !lonRef || !lon) {
    return null;
  }
  const latitudeRef = readAscii(
    buffer,
    context,
    latRef.type,
    latRef.count,
    latRef.valueOffset
  );
  const longitudeRef = readAscii(
    buffer,
    context,
    lonRef.type,
    lonRef.count,
    lonRef.valueOffset
  );
  const latitude = rationalTripletToDecimal(buffer, context, lat);
  const longitude = rationalTripletToDecimal(buffer, context, lon);
  if (
    latitude === null ||
    longitude === null ||
    (latitudeRef !== 'N' && latitudeRef !== 'S') ||
    (longitudeRef !== 'E' && longitudeRef !== 'W')
  ) {
    return null;
  }
  if (latitude < 0 || latitude > 90 || longitude < 0 || longitude > 180) {
    return null;
  }
  return {
    latitude: latitudeRef === 'S' ? -latitude : latitude,
    longitude: longitudeRef === 'W' ? -longitude : longitude,
  };
};

const findExifSegment = (buffer: Buffer): Buffer | null => {
  if (
    buffer.length < 4 ||
    buffer[0] !== JPEG_SOI_0 ||
    buffer[1] !== JPEG_SOI_1
  ) {
    return null;
  }
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0x01) {
      return null;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length + 1) {
      return null;
    }
    if (marker === APP1_MARKER) {
      const body = buffer.subarray(offset + 4, offset + 2 + length);
      if (
        body.length >= 6 &&
        body.subarray(0, 6).equals(Buffer.from('Exif\0\0', 'binary'))
      ) {
        return body.subarray(6);
      }
    }
    offset += 2 + length;
  }
  return null;
};

/**
 * Reads GPS coordinates out of a JPEG's EXIF APP1 segment. Returns null when
 * the bytes carry no usable GPS block, so callers can distinguish "no
 * location on file" from a parsed fix. Every read is bounds-checked; a
 * truncated or hostile file yields null, never a fabricated coordinate.
 */
export const extractExifGps = (buffer: Buffer): ExifGpsCoordinates | null => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    return null;
  }
  const tiff = findExifSegment(buffer);
  if (!tiff || tiff.length < 8) {
    return null;
  }
  const byteOrder = tiff.subarray(0, 2).toString('binary');
  const littleEndian = byteOrder === 'II';
  if (!littleEndian && byteOrder !== 'MM') {
    return null;
  }
  const context: TiffContext = { littleEndian, base: 0 };
  const magic = readUInt16(tiff, 2, littleEndian);
  const ifdOffset = readUInt32(tiff, 4, littleEndian);
  if (magic !== 42 || ifdOffset === null) {
    return null;
  }
  const entries = readIfdEntries(tiff, context, ifdOffset);
  if (!entries) {
    return null;
  }
  const gpsPointer = entries.find((entry) => entry.tag === GPS_IFD_POINTER_TAG);
  if (!gpsPointer || gpsPointer.count !== 1) {
    return null;
  }
  return parseGpsIfd(tiff, context, gpsPointer.valueOffset);
};

export const assertCoiStreamable = (input: {
  coiStatus: string;
  coiExpiresAt: Date | string | null;
  now?: number;
}): void => {
  if (input.coiStatus !== 'valid') {
    throw new Error(
      `Drawing is not streamable: subcontractor COI status is ${input.coiStatus}.`
    );
  }
  if (!input.coiExpiresAt) {
    throw new Error(
      'Drawing is not streamable: subcontractor COI has no expiry on file.'
    );
  }
  const expiresAt = new Date(input.coiExpiresAt).getTime();
  const now = typeof input.now === 'number' ? input.now : Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error(
      'Drawing is not streamable: subcontractor COI has expired.'
    );
  }
};
