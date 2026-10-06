import { inflateRawSync } from 'node:zlib';

/**
 * Plain text from a Word .docx file. Small towns often post agendas and
 * minutes as Word documents; a .docx is a zip archive whose body is
 * word/document.xml, so reading that one entry is enough.
 */
export function isDocx(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04 &&
    zipEntry(bytes, 'word/document.xml') !== null
  );
}

function zipEntry(bytes: Uint8Array, name: string): Buffer | null {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory record: at least 22 bytes, followed by an optional comment.
  let end = -1;
  for (
    let offset = data.length - 22;
    offset >= Math.max(0, data.length - 22 - 0xffff);
    offset -= 1
  ) {
    if (data.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) return null;
  const entries = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16);
  for (
    let index = 0;
    index < entries && offset + 46 <= data.length;
    index += 1
  ) {
    if (data.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const entryName = data.toString(
      'utf8',
      offset + 46,
      offset + 46 + nameLength
    );
    if (entryName === name) {
      if (data.readUInt32LE(localOffset) !== 0x04034b50) return null;
      const start =
        localOffset +
        30 +
        data.readUInt16LE(localOffset + 26) +
        data.readUInt16LE(localOffset + 28);
      const body = data.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(body);
      if (method === 8) return inflateRawSync(body);
      return null;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function extractDocxText(bytes: Uint8Array): string {
  const xml = zipEntry(bytes, 'word/document.xml')?.toString('utf8');
  if (!xml)
    throw new Error('not a Word document: word/document.xml is missing');
  return xml
    .replace(/<w:tab\/>/gu, '\t')
    .replace(/<w:br\/>|<\/w:p>/gu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(
      /&(amp|lt|gt|quot|apos);/gu,
      (_, entity: string) => ENTITIES[entity] ?? ''
    )
    .replace(/&#(\d+);/gu, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}
