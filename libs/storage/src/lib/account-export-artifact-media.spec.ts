import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { AccountExportArtifactMediaCollector } from './account-export-artifact-media';

const profileId = randomUUID();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=',
  'base64'
);
const ts = Buffer.alloc(188 * 3, 0xff);
ts[0] = 0x47;
ts[188] = 0x47;
ts[376] = 0x47;
const hash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const records = (
  assetId: string,
  bytes: Buffer,
  fileName = `${assetId}.png`
) => [
  {
    id: `${profileId}:${assetId}:000000000000`,
    kind: 'bytes',
    assetId,
    profileId,
    offset: 0,
    bytesBase64: bytes.toString('base64'),
  },
  {
    id: `${profileId}:${assetId}:manifest`,
    kind: 'manifest',
    assetId,
    profileId,
    fileName,
    mimeType: 'image/png',
    sizeBytes: bytes.length,
    sha256: hash(bytes),
    validation: 'signature',
  },
];

describe('AccountExportArtifactMediaCollector', () => {
  let parent: string;
  let root: string;
  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), 'artifact-media-'));
    root = join(parent, 'private');
  });
  afterEach(async () => {
    await rm(parent, { recursive: true, force: true });
  });

  it('captures unlinked file-backed media and verifies exact independent readback', async () => {
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: png.length,
    });
    const [chunk, manifest] = records(randomUUID(), png);
    await collector.accept(chunk);
    expect((await readdir(root)).length).toBe(1);
    const privateChild = join(root, (await readdir(root))[0]);
    expect(await readdir(privateChild)).toEqual([]);
    await collector.accept(manifest);
    const [entry] = await collector.finish();
    const readback = await collect(entry.createReadStream());
    expect(entry).toMatchObject({
      fileName: `${entry.assetId}.png`,
      mimeType: 'image/png',
      sizeBytes: png.length,
      sha256: hash(png),
    });
    expect(readback.equals(png)).toBe(true);
    await collector.cleanup();
    await expect(lstat(privateChild)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(collector.cleanup()).resolves.toBeUndefined();
  });

  it('rewrites HLS references to captured relative filenames and preserves source and portable hashes', async () => {
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: 1024 * 1024,
    });
    const segmentId = randomUUID();
    const playlistId = randomUUID();
    const playlist = Buffer.from(
      `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:5.0,\n/api/asset/${segmentId}\n#EXT-X-ENDLIST\n`
    );
    const [segmentChunk, segmentManifest] = tsRecords(segmentId, ts);
    await collector.accept(segmentChunk);
    await collector.accept(segmentManifest);
    const [playlistChunk, playlistManifest] = hlsRecords(playlistId, playlist, [
      segmentId,
    ]);
    await collector.accept(playlistChunk);
    await collector.accept(playlistManifest);
    const entries = await collector.finish();
    const entry = entries.find((item) => item.assetId === playlistId)!;
    const portable = await collect(entry.createReadStream());
    expect(portable.toString()).toContain(`${segmentId}.ts`);
    expect(portable.toString()).not.toContain('/api/asset/');
    expect(entry).toMatchObject({
      sourceSha256: hash(playlist),
      sourceSizeBytes: playlist.length,
      sha256: hash(portable),
      sizeBytes: portable.length,
    });
    await collector.cleanup();
  });

  it('preserves caller files and rejects symlink roots before writing', async () => {
    await import('node:fs/promises').then(({ mkdir }) => mkdir(root));
    const unrelated = join(root, 'keep.txt');
    await writeFile(unrelated, 'keep');
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: png.length,
    });
    const [chunk, manifest] = records(randomUUID(), png);
    await collector.accept(chunk);
    await collector.accept(manifest);
    await collector.finish();
    await collector.cleanup();
    expect(await readFile(unrelated, 'utf8')).toBe('keep');

    const target = join(parent, 'target');
    await import('node:fs/promises').then(({ mkdir }) => mkdir(target));
    const link = join(parent, 'link');
    await symlink(target, link);
    const unsafe = new AccountExportArtifactMediaCollector({
      root: link,
      maxBytes: png.length,
    });
    await expect(unsafe.accept(records(randomUUID(), png)[0])).rejects.toThrow(
      'MEDIA_ROOT_INVALID'
    );
    expect(await readdir(target)).toEqual([]);
  });

  it('rejects HLS references that are not captured', async () => {
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: 1024 * 1024,
    });
    const playlistId = randomUUID();
    const missing = randomUUID();
    const playlist = Buffer.from(
      `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:5.0,\n/api/asset/${missing}\n#EXT-X-ENDLIST\n`
    );
    const [chunk, manifest] = hlsRecords(playlistId, playlist, [missing]);
    await collector.accept(chunk);
    await collector.accept(manifest);
    await expect(collector.finish()).rejects.toThrow(
      'MEDIA_HLS_REFERENCE_MISSING'
    );
  });

  it.each([
    [
      'offset gap',
      (assetId: string) => [{ ...records(assetId, png)[0], offset: 1 }],
    ],
    [
      'tampered base64',
      (assetId: string) => [
        { ...records(assetId, png)[0], bytesBase64: '!!!!' },
      ],
    ],
  ])('rejects %s and cleans up', async (_label, makeRecords) => {
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: png.length,
    });
    await expect(
      collector.accept(makeRecords(randomUUID())[0])
    ).rejects.toThrow();
    await collector.cleanup();
  });

  it('rejects tampered manifest filename and hash', async () => {
    for (const mutate of [
      (r: Record<string, unknown>) => ({ ...r, fileName: '../bad.png' }),
      (r: Record<string, unknown>) => ({ ...r, sha256: '0'.repeat(64) }),
    ]) {
      const collector = new AccountExportArtifactMediaCollector({
        root: join(parent, randomUUID()),
        maxBytes: png.length,
      });
      const [chunk, manifest] = records(randomUUID(), png);
      await collector.accept(chunk);
      await expect(collector.accept(mutate(manifest))).rejects.toThrow();
      await collector.cleanup();
    }
  });

  it('rejects unmanifested assets and HLS references that were not captured', async () => {
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: 1024 * 1024,
    });
    const assetId = randomUUID();
    await collector.accept(records(assetId, png)[0]);
    await expect(collector.finish()).rejects.toThrow('MEDIA_MANIFEST_MISSING');
    await collector.cleanup();
  });

  it('rejects an already aborted collection', async () => {
    const controller = new AbortController();
    controller.abort();
    const collector = new AccountExportArtifactMediaCollector({
      root,
      maxBytes: 1024,
      signal: controller.signal,
    });
    await expect(
      collector.accept(records(randomUUID(), png)[0])
    ).rejects.toThrow('MEDIA_ABORTED');
  });
  it.each([
    [
      'application/pdf',
      '.pdf',
      Buffer.from('%PDF-1.7\nportable owned document'),
    ],
    ['audio/mpeg', '.mp3', Buffer.from([0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0])],
  ])(
    'retains the existing Assets signature policy for %s',
    async (mimeType, extension, body) => {
      const id = randomUUID(),
        bytes = body as Buffer;
      const collector = new AccountExportArtifactMediaCollector({
        root,
        maxBytes: 1024,
      });
      const pair: Array<Record<string, unknown>> = records(
        id,
        bytes,
        id + String(extension)
      );
      pair[1] = { ...pair[1], mimeType: String(mimeType) };
      await collector.accept(pair[0]);
      await collector.accept(pair[1]);
      const [entry] = await collector.finish();
      expect(await collect(entry.createReadStream())).toEqual(bytes);
      expect(entry.mimeType).toBe(mimeType);
      await collector.cleanup();
    }
  );
});

const hlsRecords = (assetId: string, bytes: Buffer, refs: string[]) => [
  {
    id: `${profileId}:${assetId}:000000000000`,
    kind: 'bytes',
    assetId,
    profileId,
    offset: 0,
    bytesBase64: bytes.toString('base64'),
  },
  {
    id: `${profileId}:${assetId}:manifest`,
    kind: 'manifest',
    assetId,
    profileId,
    fileName: `${assetId}.m3u8`,
    mimeType: 'application/vnd.apple.mpegurl',
    sizeBytes: bytes.length,
    sha256: hash(bytes),
    validation: 'signature-and-owned-hls-references',
    hlsReferenceAssetIds: refs,
  },
];

const tsRecords = (assetId: string, bytes: Buffer) => [
  {
    id: `${profileId}:${assetId}:000000000000`,
    kind: 'bytes',
    assetId,
    profileId,
    offset: 0,
    bytesBase64: bytes.toString('base64'),
  },
  {
    id: `${profileId}:${assetId}:manifest`,
    kind: 'manifest',
    assetId,
    profileId,
    fileName: `${assetId}.ts`,
    mimeType: 'video/mp2t',
    sizeBytes: bytes.length,
    sha256: hash(bytes),
    validation: 'signature',
  },
];

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
