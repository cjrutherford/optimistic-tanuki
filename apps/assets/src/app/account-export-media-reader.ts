import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';
import { AccountExportOwnerRecord } from '@optimistic-tanuki/models';

import AssetEntity from '../entities/asset.entity';
import { AppService } from './app.service';

const CHUNK_BYTES = 48 * 1024;
const DEFAULT_FILE_LIMIT = 64 * 1024 * 1024;

export class AssetsAccountExportMediaError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AssetsAccountExportMediaError';
  }
}

type MediaMime = { mimeType: string; extension: string; type: AssetType };

export class AssetsAccountExportMediaReader {
  constructor(
    private readonly opener: Pick<AppService, 'openAuthenticatedMedia'>,
    private readonly options: { maxFileBytes?: number } = {}
  ) {}

  async *read(
    asset: AssetEntity,
    options: { signal: AbortSignal; budget: { remainingBytes: number } }
  ): AsyncIterable<AccountExportOwnerRecord<'assetMedia'>> {
    let spool:
      | Awaited<ReturnType<AppService['openAuthenticatedMedia']>>
      | undefined;
    let stream: Readable | undefined;
    let abortHandler: (() => void) | undefined;
    try {
      checkAbort(options.signal);
      if (
        asset.storageStrategy !== StorageStrategy.LOCAL_BLOCK_STORAGE &&
        asset.storageStrategy !== StorageStrategy.REMOTE_BLOCK_STORAGE
      ) {
        throw new AssetsAccountExportMediaError('MEDIA_STORAGE_UNSUPPORTED');
      }
      const max = this.options.maxFileBytes ?? DEFAULT_FILE_LIMIT;
      if (
        !Number.isSafeInteger(max) ||
        max < 1 ||
        !Number.isSafeInteger(options.budget.remainingBytes) ||
        options.budget.remainingBytes < 0
      )
        throw new AssetsAccountExportMediaError('MEDIA_BUDGET_INVALID');
      const limit = Math.min(max, options.budget.remainingBytes);
      if (!limit)
        throw new AssetsAccountExportMediaError('MEDIA_BUDGET_EXCEEDED');
      spool = await this.opener.openAuthenticatedMedia(asset, {
        maxPlaintextBytes: limit,
        signal: options.signal,
      });
      checkAbort(options.signal);
      if (
        !Number.isSafeInteger(spool.size) ||
        spool.size < 0 ||
        spool.size > limit
      )
        throw new AssetsAccountExportMediaError('MEDIA_BUDGET_EXCEEDED');
      options.budget.remainingBytes -= spool.size;
      stream = spool.createReadStream();
      abortHandler = () => stream?.destroy();
      options.signal.addEventListener('abort', abortHandler, { once: true });
      checkAbort(options.signal);
      const hash = createHash('sha256');
      const prefix = `${asset.profileId}:${asset.id}`;
      let offset = 0;
      let mime: MediaMime | undefined;
      let chunk = Buffer.alloc(0);
      for await (const piece of stream) {
        checkAbort(options.signal);
        const incomingBytes = Buffer.isBuffer(piece)
          ? piece.length
          : typeof piece === 'string'
          ? Buffer.byteLength(piece)
          : piece.byteLength;
        if (incomingBytes > 64 * 1024)
          throw new AssetsAccountExportMediaError('MEDIA_CHUNK_TOO_LARGE');
        const bytes = Buffer.isBuffer(piece) ? piece : Buffer.from(piece);
        if (offset + chunk.length + bytes.length > limit)
          throw new AssetsAccountExportMediaError('MEDIA_BUDGET_EXCEEDED');
        hash.update(bytes);
        chunk = Buffer.concat([chunk, bytes]);
        if (!mime && chunk.length >= 64) {
          mime = detectMime(chunk.subarray(0, 64));
          if (!mime)
            throw new AssetsAccountExportMediaError('MEDIA_FORMAT_UNSUPPORTED');
          if (mime.type !== asset.type)
            throw new AssetsAccountExportMediaError('MEDIA_TYPE_MISMATCH');
        }
        if (!mime && offset + chunk.length < spool.size) continue;
        if (!mime) {
          mime = detectMime(chunk.subarray(0, 64));
          if (!mime)
            throw new AssetsAccountExportMediaError('MEDIA_FORMAT_UNSUPPORTED');
          if (mime.type !== asset.type)
            throw new AssetsAccountExportMediaError('MEDIA_TYPE_MISMATCH');
        }
        while (chunk.length >= CHUNK_BYTES) {
          const output = chunk.subarray(0, CHUNK_BYTES);
          const record = mediaChunk(prefix, offset, output);
          checkAbort(options.signal);
          yield record;
          checkAbort(options.signal);
          offset += output.length;
          chunk = chunk.subarray(CHUNK_BYTES);
        }
      }
      checkAbort(options.signal);
      if (!mime)
        throw new AssetsAccountExportMediaError('MEDIA_FORMAT_UNSUPPORTED');
      if (chunk.length) {
        checkAbort(options.signal);
        yield mediaChunk(prefix, offset, chunk);
        checkAbort(options.signal);
        offset += chunk.length;
      }
      if (offset !== spool.size)
        throw new AssetsAccountExportMediaError('MEDIA_SIZE_MISMATCH');
      const extension = mime.extension;
      checkAbort(options.signal);
      yield {
        source: 'assetMedia',
        data: {
          id: `${prefix}:manifest`,
          kind: 'manifest',
          assetId: asset.id,
          profileId: asset.profileId,
          fileName: `${safeAssetFileStem(asset.id)}${extension}`,
          mimeType: mime.mimeType,
          sizeBytes: offset,
          sha256: hash.digest('hex'),
          validation: 'signature',
        },
      };
      checkAbort(options.signal);
    } catch (error) {
      if (error instanceof AssetsAccountExportMediaError) throw error;
      if (options.signal.aborted)
        throw new AssetsAccountExportMediaError('MEDIA_ABORTED');
      throw new AssetsAccountExportMediaError('MEDIA_READ_FAILED');
    } finally {
      if (abortHandler)
        options.signal.removeEventListener('abort', abortHandler);
      stream?.destroy();
      await finishMediaRead(stream, spool, options.signal);
    }
  }
}

async function finishMediaRead(
  stream: Readable | undefined,
  spool: Awaited<ReturnType<AppService['openAuthenticatedMedia']>> | undefined,
  signal: AbortSignal
): Promise<void> {
  if (stream) await finished(stream).catch(() => undefined);
  let cleanupFailed = false;
  if (spool) {
    try {
      await spool.cleanup();
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed)
    throw new AssetsAccountExportMediaError('MEDIA_CLEANUP_FAILED');
  if (signal.aborted) throw new AssetsAccountExportMediaError('MEDIA_ABORTED');
}

function safeAssetFileStem(assetId: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    assetId
  )
    ? assetId
    : randomUUID();
}

function mediaChunk(
  prefix: string,
  offset: number,
  bytes: Buffer
): AccountExportOwnerRecord<'assetMedia'> {
  return {
    source: 'assetMedia',
    data: {
      id: `${prefix}:${String(offset).padStart(12, '0')}`,
      kind: 'bytes',
      assetId: prefix.slice(prefix.indexOf(':') + 1),
      profileId: prefix.slice(0, prefix.indexOf(':')),
      offset,
      bytesBase64: bytes.toString('base64'),
    },
  };
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new AssetsAccountExportMediaError('MEDIA_ABORTED');
}

function detectMime(b: Buffer): MediaMime | undefined {
  const has = (signature: number[], offset = 0) =>
    signature.every((v, i) => b[offset + i] === v);
  if (has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mimeType: 'image/png', extension: '.png', type: AssetType.IMAGE };
  if (has([0xff, 0xd8, 0xff]))
    return { mimeType: 'image/jpeg', extension: '.jpg', type: AssetType.IMAGE };
  if (
    b
      .subarray(0, 6)
      .toString('ascii')
      .match(/^GIF8[79]a$/)
  )
    return { mimeType: 'image/gif', extension: '.gif', type: AssetType.IMAGE };
  if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return {
      mimeType: 'image/webp',
      extension: '.webp',
      type: AssetType.IMAGE,
    };
  if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12);
    if (['qt  '].includes(brand))
      return {
        mimeType: 'video/quicktime',
        extension: '.mov',
        type: AssetType.VIDEO,
      };
    if (
      ![
        'isom',
        'iso2',
        'iso3',
        'iso4',
        'iso5',
        'iso6',
        'mp41',
        'mp42',
        'avc1',
        'M4V ',
        'dash',
        'MSNV',
      ].includes(brand)
    )
      return undefined;
    return { mimeType: 'video/mp4', extension: '.mp4', type: AssetType.VIDEO };
  }
  if (
    b.length >= 8 &&
    b[0] === 0x1a &&
    b[1] === 0x45 &&
    b[2] === 0xdf &&
    b[3] === 0xa3 &&
    b.includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))
  )
    return {
      mimeType: 'video/webm',
      extension: '.webm',
      type: AssetType.VIDEO,
    };
  if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WAVE'
  )
    return { mimeType: 'audio/wav', extension: '.wav', type: AssetType.AUDIO };
  if (b.toString('ascii', 0, 4) === 'OggS')
    return { mimeType: 'audio/ogg', extension: '.ogg', type: AssetType.AUDIO };
  if (
    b.toString('ascii', 0, 3) === 'ID3' ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  )
    return { mimeType: 'audio/mpeg', extension: '.mp3', type: AssetType.AUDIO };
  if (b.toString('ascii', 0, 5) === '%PDF-')
    return {
      mimeType: 'application/pdf',
      extension: '.pdf',
      type: AssetType.DOCUMENT,
    };
  return undefined;
}
