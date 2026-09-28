import {
  assertCoiStreamable,
  extractExifGps,
  sha256Hex,
} from './photo-evidence.service';

type Degrees = [number, number, number];

const buildExifJpeg = (
  options: {
    latitude?: Degrees;
    latRef?: string;
    longitude?: Degrees;
    lonRef?: string;
    bigEndian?: boolean;
    omitGps?: boolean;
  } = {}
): Buffer => {
  const littleEndian = !options.bigEndian;
  const u16 = (value: number): Buffer => {
    const part = Buffer.alloc(2);
    if (littleEndian) {
      part.writeUInt16LE(value);
    } else {
      part.writeUInt16BE(value);
    }
    return part;
  };
  const u32 = (value: number): Buffer => {
    const part = Buffer.alloc(4);
    if (littleEndian) {
      part.writeUInt32LE(value);
    } else {
      part.writeUInt32BE(value);
    }
    return part;
  };
  const asciiValue = (text: string): Buffer => {
    const part = Buffer.alloc(4);
    part.write(text.slice(0, 4), 'ascii');
    return part;
  };
  const rational = (numerator: number, denominator: number): Buffer =>
    Buffer.concat([u32(numerator), u32(denominator)]);

  const latitude = options.latitude ?? [31, 7, 24];
  const longitude = options.longitude ?? [83, 27, 21];
  const latRef = options.latRef ?? 'N';
  const lonRef = options.lonRef ?? 'E';

  const gpsData = Buffer.concat([
    rational(latitude[0], 1),
    rational(latitude[1], 1),
    rational(latitude[2], 1),
    rational(longitude[0], 1),
    rational(longitude[1], 1),
    rational(longitude[2], 1),
  ]);
  const gpsIfdOffset = 8 + 2 + 12 + 4;
  const gpsDataOffset = gpsIfdOffset + 2 + 4 * 12 + 4;
  const gpsIfd = Buffer.concat([
    u16(4),
    Buffer.concat([u16(0x0001), u16(2), u32(2), asciiValue(latRef)]),
    Buffer.concat([u16(0x0002), u16(5), u32(3), u32(gpsDataOffset)]),
    Buffer.concat([u16(0x0003), u16(2), u32(2), asciiValue(lonRef)]),
    Buffer.concat([u16(0x0004), u16(5), u32(3), u32(gpsDataOffset + 24)]),
    u32(0),
  ]);
  const ifd0 = options.omitGps
    ? Buffer.concat([u16(0), u32(0)])
    : Buffer.concat([
        u16(1),
        Buffer.concat([u16(0x8825), u16(4), u32(1), u32(gpsIfdOffset)]),
        u32(0),
      ]);
  const tiff = Buffer.concat([
    Buffer.from(littleEndian ? 'II' : 'MM', 'binary'),
    u16(42),
    u32(8),
    ifd0,
    ...(options.omitGps ? [] : [gpsIfd, gpsData]),
  ]);
  const exifBody = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    (() => {
      const length = Buffer.alloc(2);
      length.writeUInt16BE(exifBody.length + 2);
      return length;
    })(),
    exifBody,
  ]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app1,
    Buffer.from([0xff, 0xd9]),
  ]);
};

describe('photo evidence helpers', () => {
  it('hashes bytes with SHA-256', () => {
    expect(sha256Hex(Buffer.from('beam'))).toBe(
      'ae4b867cf2eeb128ceab8c7df148df2eacfe2be35dbd40856a77bfc74f882236'
    );
  });

  it('reads GPS coordinates from a little-endian EXIF block', () => {
    const gps = extractExifGps(buildExifJpeg());

    expect(gps).toEqual({
      latitude: expect.closeTo(31 + 7 / 60 + 24 / 3600, 6),
      longitude: expect.closeTo(83 + 27 / 60 + 21 / 3600, 6),
    });
  });

  it('reads GPS coordinates from a big-endian EXIF block', () => {
    const gps = extractExifGps(buildExifJpeg({ bigEndian: true }));

    expect(gps?.latitude).toBeCloseTo(31 + 7 / 60 + 24 / 3600, 6);
    expect(gps?.longitude).toBeCloseTo(83 + 27 / 60 + 21 / 3600, 6);
  });

  it('applies hemisphere signs', () => {
    const gps = extractExifGps(buildExifJpeg({ latRef: 'S', lonRef: 'W' }));

    expect(gps?.latitude).toBeLessThan(0);
    expect(gps?.longitude).toBeLessThan(0);
  });

  it('returns null when no GPS block is on file', () => {
    expect(extractExifGps(buildExifJpeg({ omitGps: true }))).toBeNull();
  });

  it('returns null for non-jpeg and truncated bytes', () => {
    expect(extractExifGps(Buffer.from('not a jpeg at all'))).toBeNull();
    expect(extractExifGps(Buffer.alloc(0))).toBeNull();
    const truncated = buildExifJpeg().subarray(0, 20);
    expect(extractExifGps(truncated)).toBeNull();
  });

  it('rejects unstreamable COI states', () => {
    expect(() =>
      assertCoiStreamable({ coiStatus: 'expired', coiExpiresAt: new Date() })
    ).toThrow(/not streamable/);
    expect(() =>
      assertCoiStreamable({ coiStatus: 'valid', coiExpiresAt: null })
    ).toThrow(/no expiry/);
    expect(() =>
      assertCoiStreamable({
        coiStatus: 'valid',
        coiExpiresAt: new Date(Date.now() - 1000),
      })
    ).toThrow(/expired/);
    expect(() =>
      assertCoiStreamable({
        coiStatus: 'valid',
        coiExpiresAt: new Date(Date.now() + 86400000),
      })
    ).not.toThrow();
  });
});
