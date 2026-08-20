import { deflateRawSync, crc32 } from 'node:zlib';

/**
 * Minimal ZIP writer.
 *
 * Both OpenDocument (.odt) and OOXML (.docx) are ZIP containers of XML parts,
 * and Node's zlib provides everything needed to build one. Written here rather
 * than pulling in a zip dependency: the format is small and stable, and the
 * alternative is adding a third-party package to a monorepo for ~100 lines of
 * well-specified work.
 *
 * ODT additionally requires its `mimetype` entry to be stored uncompressed and
 * written first, which is why entries carry an explicit `store` flag.
 */

export interface ZipEntry {
  path: string;
  content: string | Buffer;
  /** Write without compression. Required for ODT's `mimetype` entry. */
  store?: boolean;
}

const DOS_EPOCH = new Date(1980, 0, 1);

const toDosDateTime = (date: Date): { time: number; date: number } => {
  const safe = date < DOS_EPOCH ? DOS_EPOCH : date;
  const time =
    (safe.getHours() << 11) |
    (safe.getMinutes() << 5) |
    Math.floor(safe.getSeconds() / 2);
  const dosDate =
    ((safe.getFullYear() - 1980) << 9) |
    ((safe.getMonth() + 1) << 5) |
    safe.getDate();
  return { time, date: dosDate };
};

export const createZip = (entries: ZipEntry[], now = new Date()): Buffer => {
  const { time, date } = toDosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.path, 'utf8');
    const raw = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');

    const compressed = entry.store ? raw : deflateRawSync(raw);
    const method = entry.store ? 0 : 8;
    const checksum = crc32(raw) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, central, end]);
};

/** XML text escaping; documents carry arbitrary user prose. */
export const escapeXml = (value: string): string =>
  (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
