import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';

import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';
import { EnvelopeEncryptionService } from '@optimistic-tanuki/storage';
import { LocalStorageAdapter } from '@optimistic-tanuki/storage';
import { VerifiedMediaSpoolService } from '@optimistic-tanuki/storage';
import { Logger } from '@nestjs/common';

import AssetEntity from '../entities/asset.entity';
import {
  AssetsAccountExportMediaError,
  AssetsAccountExportMediaReader,
} from './account-export-media-reader';

describe('AssetsAccountExportMediaReader', () => {
  const execFile = promisify(execFileCb);
  const kek = 'assets-export-fixed-test-only-kek-material';
  let root: string;
  let storageRoot: string;
  let spoolRoot: string;
  let encryption: EnvelopeEncryptionService;
  let spools: VerifiedMediaSpoolService;
  let adapter: LocalStorageAdapter;
  let reader: AssetsAccountExportMediaReader;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'assets-export-reader-'));
    storageRoot = join(root, 'stored');
    spoolRoot = join(root, 'spool');
    await mkdir(storageRoot, { recursive: true });
    encryption = new EnvelopeEncryptionService({ VAULT_STORAGE_KEK: kek });
    spools = new VerifiedMediaSpoolService(encryption, {
      spoolRoot,
      maxPlaintextBytes: 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024 * 1024,
    });
    adapter = new LocalStorageAdapter(
      new Logger('AssetsExportTest'),
      storageRoot,
      encryption,
      undefined,
      { isZfsRequired: () => false } as any,
      spools
    );
    reader = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: (asset, options) =>
        adapter.openAuthenticatedMedia(asset, options),
    } as any);
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  function asset(id = 'asset-one', type = AssetType.IMAGE): AssetEntity {
    return {
      id,
      profileId: 'profile-one',
      type,
      name: '../../private-name.png',
      storagePath: `${id}.bin`,
      storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
    } as AssetEntity;
  }

  async function put(
    assetRecord: AssetEntity,
    content: Buffer,
    tamper = false
  ): Promise<void> {
    const envelope = encryption.encrypt(content);
    if (tamper) envelope[envelope.length - 1] ^= 0xff;
    await writeFile(join(storageRoot, assetRecord.storagePath), envelope);
  }

  it('streams real authenticated PNG bytes with a detected safe manifest and digest', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
      'base64'
    );
    const item = asset('01234567-89ab-4cde-8fab-0123456789ab');
    await put(item, image);
    const records = [];
    for await (const record of reader.read(item, {
      signal: new AbortController().signal,
      budget: { remainingBytes: image.length },
    }))
      records.push(record);
    const chunks = records.filter((r) => r.data['kind'] === 'bytes');
    const roundtrip = Buffer.concat(
      chunks.map((r) => Buffer.from(r.data['bytesBase64'] as string, 'base64'))
    );
    expect(roundtrip).toEqual(image);
    const manifest = records[records.length - 1].data;
    expect(manifest).toMatchObject({
      kind: 'manifest',
      mimeType: 'image/png',
      sizeBytes: image.length,
      sha256: createHash('sha256').update(image).digest('hex'),
      validation: 'signature',
    });
    expect(manifest['fileName']).toBe(`${item.id}.png`);
    expect(JSON.stringify(records)).not.toContain('private-name');
  });

  it('does not yield plaintext when envelope authentication fails and removes spool output', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
      'base64'
    );
    const item = asset('broken');
    await put(item, image, true);
    const iterator = reader
      .read(item, {
        signal: new AbortController().signal,
        budget: { remainingBytes: 1000 },
      })
      [Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toMatchObject({
      code: 'MEDIA_READ_FAILED',
    });
    expect(await readdir(spools.processDirectory)).toEqual([]);
  });

  it('streams a real ffmpeg MP4 fixture byte-for-byte with detected MIME and digest', async () => {
    const item = asset('real-video', AssetType.VIDEO);
    const fixturePath = join(root, 'fixture.mp4');
    await execFile(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=16x16:d=0.1',
        '-frames:v',
        '1',
        '-movflags',
        '+faststart',
        '-y',
        fixturePath,
      ],
      { timeout: 10_000, maxBuffer: 1024 * 1024 }
    );
    const video = await readFile(fixturePath);
    expect(video.length).toBeGreaterThan(64);
    await put(item, video);
    const records = [];
    for await (const record of reader.read(item, {
      signal: new AbortController().signal,
      budget: { remainingBytes: video.length },
    }))
      records.push(record);
    const output = Buffer.concat(
      records
        .filter((r) => r.data['kind'] === 'bytes')
        .map((r) => Buffer.from(r.data['bytesBase64'] as string, 'base64'))
    );
    expect(output).toEqual(video);
    expect(records.at(-1)?.data).toMatchObject({
      kind: 'manifest',
      mimeType: 'video/mp4',
      sizeBytes: video.length,
      sha256: createHash('sha256').update(video).digest('hex'),
      validation: 'signature',
    });
    expect(records.at(-1)?.data['fileName']).toMatch(/^[0-9a-f-]{36}\.mp4$/);
  });

  it('streams a real ffmpeg WebM fixture byte-for-byte with detected MIME and digest', async () => {
    const item = asset('real-webm', AssetType.VIDEO);
    const fixturePath = join(root, 'fixture.webm');
    await execFile(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=16x16:d=0.1',
        '-frames:v',
        '1',
        '-c:v',
        'libvpx',
        '-deadline',
        'realtime',
        '-cpu-used',
        '8',
        '-y',
        fixturePath,
      ],
      { timeout: 10_000, maxBuffer: 1024 * 1024 }
    );
    const video = await readFile(fixturePath);
    expect(video.length).toBeGreaterThan(64);
    await put(item, video);
    const records = [];
    for await (const record of reader.read(item, {
      signal: new AbortController().signal,
      budget: { remainingBytes: video.length },
    }))
      records.push(record);
    const output = Buffer.concat(
      records
        .filter((r) => r.data['kind'] === 'bytes')
        .map((r) => Buffer.from(r.data['bytesBase64'] as string, 'base64'))
    );
    expect(output).toEqual(video);
    expect(records.at(-1)?.data).toMatchObject({
      kind: 'manifest',
      mimeType: 'video/webm',
      sizeBytes: video.length,
      sha256: createHash('sha256').update(video).digest('hex'),
      validation: 'signature',
    });
  });

  it('validates HLS references before yielding the original playlist and includes them in its manifest', async () => {
    const id = '01234567-89ab-4cde-8fab-0123456789ab';
    const item = asset('21234567-89ab-4cde-8fab-0123456789ab', AssetType.VIDEO);
    const bytes = Buffer.from(
      [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:6.000,',
        `/api/asset/${id}`,
        '#EXT-X-ENDLIST',
        '',
      ].join('\n')
    );
    await put(item, bytes);
    const seen = [];
    const records = [];
    for await (const record of reader.read(item, {
      signal: new AbortController().signal,
      budget: { remainingBytes: bytes.length },
      validateHlsReferences: async (ids) => {
        seen.push(ids);
        expect(records).toHaveLength(0);
      },
    }))
      records.push(record);
    const output = Buffer.concat(
      records
        .filter((r) => r.data['kind'] === 'bytes')
        .map((r) => Buffer.from(r.data['bytesBase64'] as string, 'base64'))
    );
    expect(seen).toEqual([[id]]);
    expect(output).toEqual(bytes);
    expect(records.at(-1)?.data).toMatchObject({
      mimeType: 'application/vnd.apple.mpegurl',
      fileName: `${item.id}.m3u8`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      hlsReferenceAssetIds: [id],
    });
  });

  it('does not yield an HLS playlist when reference validation is missing or fails', async () => {
    const id = '01234567-89ab-4cde-8fab-0123456789ab';
    const item = asset('hls-unvalidated', AssetType.VIDEO);
    const bytes = Buffer.from(
      [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:1',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:1,',
        `/api/asset/${id}`,
        '#EXT-X-ENDLIST',
        '',
      ].join('\n')
    );
    await put(item, bytes);
    for (const [extra, expectedCode] of [
      [{}, 'MEDIA_HLS_VALIDATION_REQUIRED'],
      [
        {
          validateHlsReferences: async () => {
            throw new Error('private detail');
          },
        },
        'MEDIA_READ_FAILED',
      ],
    ] as const) {
      const iterator = reader
        .read(item, {
          signal: new AbortController().signal,
          budget: { remainingBytes: bytes.length },
          ...extra,
        })
        [Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toMatchObject({
        code: expectedCode,
      });
    }
  });

  it('sniffs real MPEG-TS only after three transport packets and preserves its bytes', async () => {
    const item = asset('real-ts', AssetType.VIDEO);
    const fixturePath = join(root, 'fixture.ts');
    await execFile(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=16x16:d=0.2',
        '-c:v',
        'libx264',
        '-f',
        'mpegts',
        '-y',
        fixturePath,
      ],
      { timeout: 10_000, maxBuffer: 1024 * 1024 }
    );
    const bytes = await readFile(fixturePath);
    expect(bytes.length).toBeGreaterThanOrEqual(564);
    await put(item, bytes);
    const records = [];
    for await (const record of reader.read(item, {
      signal: new AbortController().signal,
      budget: { remainingBytes: bytes.length },
    }))
      records.push(record);
    const output = Buffer.concat(
      records
        .filter((r) => r.data['kind'] === 'bytes')
        .map((r) => Buffer.from(r.data['bytesBase64'] as string, 'base64'))
    );
    expect(output).toEqual(bytes);
    expect(records.at(-1)?.data).toMatchObject({
      mimeType: 'video/mp2t',
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  });

  it('fails closed for wrong KEK, missing files, and adapters without authenticated streaming', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
      'base64'
    );
    const wrongKeyItem = asset('wrong-key');
    await put(wrongKeyItem, image);
    const wrongEncryption = new EnvelopeEncryptionService({
      VAULT_STORAGE_KEK: 'a-different-test-kek-that-is-not-production',
    });
    const wrongSpools = new VerifiedMediaSpoolService(wrongEncryption, {
      spoolRoot: join(root, 'wrong-key-spool'),
      maxPlaintextBytes: 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024,
    });
    const wrongAdapter = new LocalStorageAdapter(
      new Logger('AssetsWrongKeyTest'),
      storageRoot,
      wrongEncryption,
      undefined,
      { isZfsRequired: () => false } as any,
      wrongSpools
    );
    const wrongReader = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: (item, opts) =>
        wrongAdapter.openAuthenticatedMedia(item, opts),
    } as any);
    await expect(
      wrongReader
        .read(wrongKeyItem, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 1024 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_READ_FAILED' });

    const missing = asset('missing');
    await expect(
      reader
        .read(missing, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 1024 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_READ_FAILED' });
    const unsupported = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: undefined,
    } as any);
    await expect(
      unsupported
        .read(wrongKeyItem, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 1024 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_READ_FAILED' });
  });

  it('enforces the per-file limit before yielding and charges the shared budget', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
      'base64'
    );
    const item = asset('per-file');
    await put(item, image);
    const limited = new AssetsAccountExportMediaReader(
      {
        openAuthenticatedMedia: (record, opts) =>
          adapter.openAuthenticatedMedia(record, opts),
      } as any,
      { maxFileBytes: image.length - 1 }
    );
    await expect(
      limited
        .read(item, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 1000 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_READ_FAILED' });
    const budget = { remainingBytes: image.length };
    for await (const _record of reader.read(item, {
      signal: new AbortController().signal,
      budget,
    })) {
      /* consume */
    }
    expect(budget.remainingBytes).toBe(0);
  });

  it('aborts a pending spool stream and treats cleanup failure as capture failure', async () => {
    const pending = new Readable({
      read() {
        /* waits for abort */
      },
    });
    const abortController = new AbortController();
    const blockingReader = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: async (_item, _opts) => ({
        path: 'private-path',
        size: 100,
        createReadStream: () => pending,
        cleanup: async () => undefined,
      }),
    } as any);
    const iterator = blockingReader
      .read(asset('abort-during-read'), {
        signal: abortController.signal,
        budget: { remainingBytes: 100 },
      })
      [Symbol.asyncIterator]();
    const first = iterator.next();
    await new Promise((resolve) => setImmediate(resolve));
    abortController.abort();
    await expect(first).rejects.toMatchObject({ code: 'MEDIA_ABORTED' });

    const cleanupReader = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: async () => ({
        path: 'private-path',
        size: 8,
        createReadStream: () => Readable.from([Buffer.from('%PDF-1.7')]),
        cleanup: async () => {
          throw new Error('cleanup error');
        },
      }),
    } as any);
    await expect(
      (async () => {
        for await (const _record of cleanupReader.read(
          asset('cleanup', AssetType.DOCUMENT),
          {
            signal: new AbortController().signal,
            budget: { remainingBytes: 100 },
          }
        )) {
          /* consume until cleanup runs */
        }
      })()
    ).rejects.toMatchObject({ code: 'MEDIA_CLEANUP_FAILED' });

    const abortCleanupReader = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: async () => ({
        path: 'private-path',
        size: 100,
        createReadStream: () =>
          new Readable({
            read() {
              /* waits for abort */
            },
          }),
        cleanup: async () => {
          throw new Error('cleanup error');
        },
      }),
    } as any);
    const abortCleanup = new AbortController();
    const abortCleanupIterator = abortCleanupReader
      .read(asset('abort-cleanup'), {
        signal: abortCleanup.signal,
        budget: { remainingBytes: 100 },
      })
      [Symbol.asyncIterator]();
    const pendingNext = abortCleanupIterator.next();
    await new Promise((resolve) => setImmediate(resolve));
    abortCleanup.abort();
    await expect(pendingNext).rejects.toMatchObject({
      code: 'MEDIA_CLEANUP_FAILED',
    });
  });

  it('rejects unsupported signatures and asset type mismatches without records', async () => {
    const item = asset('unknown');
    await put(item, Buffer.from('plain bytes'));
    const iterator = reader
      .read(item, {
        signal: new AbortController().signal,
        budget: { remainingBytes: 100 },
      })
      [Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toMatchObject({
      code: 'MEDIA_FORMAT_UNSUPPORTED',
    });
    const video = asset('mismatch', AssetType.VIDEO);
    await put(
      video,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
        'base64'
      )
    );
    await expect(
      reader
        .read(video, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 1000 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_TYPE_MISMATCH' });

    const avif = asset('avif-container', AssetType.VIDEO);
    await put(
      avif,
      Buffer.from([
        0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0,
      ])
    );
    await expect(
      reader
        .read(avif, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 100 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_FORMAT_UNSUPPORTED' });
  });

  it('rejects invalid budget integers and oversized adapter chunks before buffering', async () => {
    const item = asset('oversized-adapter');
    await expect(
      reader
        .read(item, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 1.5 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_BUDGET_INVALID' });
    const oversizedReader = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia: async () => ({
        path: 'private-path',
        size: 65_537,
        createReadStream: () => Readable.from([Buffer.alloc(65_537)]),
        cleanup: async () => undefined,
      }),
    } as any);
    await expect(
      oversizedReader
        .read(item, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 100_000 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_CHUNK_TOO_LARGE' });
  });

  it('rejects database storage strategy before opening an otherwise valid encrypted file', async () => {
    const item = asset('database-row');
    item.storageStrategy = StorageStrategy.DATABASE_STORAGE;
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
      'base64'
    );
    await put(item, image);
    const openAuthenticatedMedia = jest.fn(
      (
        record: AssetEntity,
        opts: { maxPlaintextBytes: number; signal?: AbortSignal }
      ) => adapter.openAuthenticatedMedia(record, opts)
    );
    const guarded = new AssetsAccountExportMediaReader({
      openAuthenticatedMedia,
    } as any);
    await expect(
      guarded
        .read(item, {
          signal: new AbortController().signal,
          budget: { remainingBytes: image.length },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_STORAGE_UNSUPPORTED' });
    expect(openAuthenticatedMedia).not.toHaveBeenCalled();
  });

  it('enforces the total export budget and handles abort before opening storage', async () => {
    const item = asset('budget');
    await put(item, Buffer.from('x'));
    await expect(
      reader
        .read(item, {
          signal: new AbortController().signal,
          budget: { remainingBytes: 0 },
        })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_BUDGET_EXCEEDED' });
    const abort = new AbortController();
    abort.abort();
    await expect(
      reader
        .read(item, { signal: abort.signal, budget: { remainingBytes: 20 } })
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toMatchObject({ code: 'MEDIA_ABORTED' });
  });
});
