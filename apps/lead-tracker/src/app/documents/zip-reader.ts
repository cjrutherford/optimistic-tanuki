import { inflateRawSync } from 'zlib';

/**
 * Minimal ZIP reader, enough to pull one named entry out of an Office or
 * OpenDocument file.
 *
 * DOCX and ODT are ZIP containers whose text lives in a deflated XML part.
 * Reading them needs the central directory, not a full archiver, and this
 * mirrors `zip-writer.ts` on the other side of the same format rather than
 * pulling in a dependency to undo what we already hand-roll.
 *
 * Deliberately narrow: it reads stored and deflated entries from a
 * single-disk archive. Encrypted, spanned, or ZIP64 archives are rejected
 * rather than guessed at, because a resume that silently reads as nothing is
 * the failure this whole change exists to remove.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;

/** Max bytes of trailing comment the end-of-central-directory may hide behind. */
const MAX_EOCD_SEARCH = 66 * 1024;

const STORED = 0;
const DEFLATED = 8;

export class ZipReadError extends Error {}

interface CentralEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  encrypted: boolean;
}

const findEndOfCentralDirectory = (buffer: Buffer): number => {
  // The EOCD sits at the end, but a trailing comment can push it back, so scan
  // backwards rather than assuming it is the last 22 bytes.
  const start = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new ZipReadError(
    'Not a ZIP archive: no end-of-central-directory record.'
  );
};

const readCentralDirectory = (buffer: Buffer): CentralEntry[] => {
  const eocd = findEndOfCentralDirectory(buffer);

  if (
    eocd >= 20 &&
    buffer.readUInt32LE(eocd - 20) === ZIP64_EOCD_LOCATOR_SIGNATURE
  ) {
    throw new ZipReadError('ZIP64 archives are not supported.');
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: CentralEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length) {
      throw new ZipReadError('Truncated ZIP central directory.');
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_FILE_SIGNATURE) {
      throw new ZipReadError('Corrupt ZIP central directory.');
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);

    entries.push({
      name: buffer
        .subarray(offset + 46, offset + 46 + nameLength)
        .toString('utf8'),
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
      // Bit 0 of the general-purpose flags marks an encrypted entry.
      encrypted: (flags & 0x0001) !== 0,
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

const readEntryData = (buffer: Buffer, entry: CentralEntry): Buffer => {
  const header = entry.localHeaderOffset;
  if (header + 30 > buffer.length) {
    throw new ZipReadError(`Truncated ZIP entry "${entry.name}".`);
  }
  if (buffer.readUInt32LE(header) !== LOCAL_FILE_SIGNATURE) {
    throw new ZipReadError(`Corrupt ZIP entry "${entry.name}".`);
  }

  // The local header repeats the name and extra fields, and its lengths are the
  // authoritative ones for locating the payload — they can differ from the
  // central directory's.
  const nameLength = buffer.readUInt16LE(header + 26);
  const extraLength = buffer.readUInt16LE(header + 28);
  const dataStart = header + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === STORED) {
    return Buffer.from(data);
  }
  if (entry.compressionMethod === DEFLATED) {
    try {
      return inflateRawSync(data);
    } catch (error) {
      throw new ZipReadError(
        `Could not decompress ZIP entry "${entry.name}": ${
          (error as Error).message
        }`
      );
    }
  }

  throw new ZipReadError(
    `ZIP entry "${entry.name}" uses unsupported compression method ${entry.compressionMethod}.`
  );
};

/** True when the buffer starts with a local file header. */
export const isZipContainer = (buffer: Buffer): boolean =>
  buffer.length >= 4 && buffer.readUInt32LE(0) === LOCAL_FILE_SIGNATURE;

/**
 * Returns the decompressed bytes of the first entry whose name matches, or
 * null when the archive has no such entry.
 */
export const readZipEntry = (
  buffer: Buffer,
  matches: (name: string) => boolean
): Buffer | null => {
  const entry = readCentralDirectory(buffer).find((candidate) =>
    matches(candidate.name)
  );
  if (!entry) {
    return null;
  }
  if (entry.encrypted) {
    throw new ZipReadError(`ZIP entry "${entry.name}" is password protected.`);
  }

  return readEntryData(buffer, entry);
};
