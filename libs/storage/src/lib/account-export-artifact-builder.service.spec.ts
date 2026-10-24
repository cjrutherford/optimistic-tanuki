import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ACCOUNT_EXPORT_RELEASE_OWNERS,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';
import { AccountExportOwnerEmitter } from './account-export-owner-emitter';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolHandle,
} from './account-export-owner-spool.service';
import { AccountExportArtifactBuilderService } from './account-export-artifact-builder.service';

const accountId = randomUUID();
const source = 'fixture' as const;
const expected = Object.fromEntries(
  ACCOUNT_EXPORT_RELEASE_OWNERS.map((owner) => [owner, [source]])
);

async function* records(owner: string) {
  yield {
    source,
    data: {
      id: '0001',
      userId: accountId,
      owner,
      fullTextCanary:
        'preserve <script> literal "quotes" and newlines\nverbatim',
    },
  };
}

async function capture(
  owner: string,
  root: string
): Promise<OwnerSpoolHandle<string>> {
  const spool = new AccountExportOwnerSpoolService();
  return spool.capture(
    { participantId: owner, accountId, sources: [source], spoolRoot: root },
    async (sink, signal) => {
      const emitter = new AccountExportOwnerEmitter(
        {
          participantId: owner,
          accountId,
          captureId: randomUUID(),
          snapshotAt: '2026-10-24T12:00:00.000Z',
          sources: [source],
          signal,
        },
        async (chunk) => sink(chunk)
      );
      await emitter.emitSources({ [source]: () => records(owner) });
      return emitter.complete();
    }
  );
}

async function bytes(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseTar(tar: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (
    offset + 512 <= tar.length &&
    tar.subarray(offset, offset + 512).some((value) => value !== 0)
  ) {
    const header = tar.subarray(offset, offset + 512);
    const expectedChecksum = parseInt(header.toString('ascii', 148, 154), 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(32, 148, 156);
    expect([...checksumHeader].reduce((sum, byte) => sum + byte, 0)).toBe(
      expectedChecksum
    );
    const name = header.toString('ascii', 0, 100).replace(/\0.*$/, '');
    const size = parseInt(
      header.toString('ascii', 124, 135).replace(/\0.*$/, ''),
      8
    );
    const dataStart = offset + 512;
    const data = tar.subarray(dataStart, dataStart + size);
    entries.set(name, Buffer.from(data));
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

describe('AccountExportArtifactBuilderService', () => {
  let root: string;
  let owners: OwnerSpoolHandle<string>[];
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'artifact-builder-test-'));
    owners = [];
  });
  afterEach(async () => {
    await Promise.all(owners.map((owner) => owner.cleanup()));
    await rm(root, { recursive: true, force: true });
  });

  it('writes a valid TAR with independently checked headers and exact staged owner bytes', async () => {
    for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS)
      owners.push(await capture(owner, root));
    const builder = new AccountExportArtifactBuilderService();
    const artifact = await builder.build({
      appId: 'client-interface',
      accountId,
      owners,
      expectedSourcesByOwner: expected,
      spoolRoot: root,
    });
    try {
      const tar = await bytes(artifact.createReadStream());
      expect(artifact.metadata.sizeBytes).toBe(tar.length);
      const entries = parseTar(tar);
      expect([...entries.keys()]).toEqual([
        'manifest.json',
        ...ACCOUNT_EXPORT_RELEASE_OWNERS.map(
          (owner) => `owners/${owner}.ndjson`
        ),
      ]);
      const manifest = JSON.parse(
        entries.get('manifest.json')!.toString('utf8')
      );
      expect(manifest.owners).toHaveLength(12);
      expect(manifest.owners[0]).toHaveProperty('captureId');
      expect(entries.get('owners/authentication.ndjson')!.toString()).toContain(
        'preserve <script> literal'
      );
      for (const item of manifest.owners) {
        const data = entries.get(`owners/${item.owner}.ndjson`)!;
        expect(data.length).toBe(item.sizeBytes);
        const digest = require('node:crypto')
          .createHash('sha256')
          .update(data)
          .digest('hex');
        expect(digest).toBe(item.sha256);
      }
      expect(await artifact.readChunk(0, 512)).toEqual(tar.subarray(0, 512));
    } finally {
      await artifact.cleanup();
    }
  });

  it('rejects mutated second reads using only the single verified pass', async () => {
    for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS)
      owners.push(await capture(owner, root));
    const first = owners[0];
    let reads = 0;
    const changed = {
      ...first,
      createReadStream: () => {
        reads++;
        return first.createReadStream();
      },
    } as OwnerSpoolHandle<string>;
    owners[0] = changed;
    const result = await new AccountExportArtifactBuilderService().build({
      appId: 'client-interface',
      accountId,
      owners,
      expectedSourcesByOwner: expected,
      spoolRoot: root,
    });
    expect(reads).toBe(1);
    await result.cleanup();
  });

  it('rejects an untrusted owner and an already aborted build', async () => {
    for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS)
      owners.push(await capture(owner, root));
    const bad = [...owners];
    bad[0] = {
      ...bad[0],
      metadata: { ...bad[0].metadata, participantId: 'attacker' },
    } as OwnerSpoolHandle<string>;
    await expect(
      new AccountExportArtifactBuilderService().build({
        appId: 'client-interface',
        accountId,
        owners: bad,
        expectedSourcesByOwner: expected,
        spoolRoot: root,
      })
    ).rejects.toThrow('ARTIFACT_OWNER_SET_INVALID');
    const controller = new AbortController();
    controller.abort();
    await expect(
      new AccountExportArtifactBuilderService().build({
        appId: 'client-interface',
        accountId,
        owners,
        expectedSourcesByOwner: expected,
        signal: controller.signal,
        spoolRoot: root,
      })
    ).rejects.toThrow('ARTIFACT_ABORTED');
  });
  it('bounds artifact size and cleans private staging after a rejected build', async () => {
    for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS)
      owners.push(await capture(owner, root));
    await expect(
      new AccountExportArtifactBuilderService().build({
        appId: 'local-hub',
        accountId,
        owners,
        expectedSourcesByOwner: expected,
        spoolRoot: root,
        maxArtifactBytes: 1024,
      })
    ).rejects.toThrow('ARTIFACT_TOO_LARGE');
    expect(
      (await readdir(root)).filter((name) =>
        name.startsWith('ot-account-export-')
      )
    ).toEqual([]);
  });

  it('rejects byte tampering and leaves no named plaintext during or after success', async () => {
    for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS)
      owners.push(await capture(owner, root));
    const body = await bytes(owners[0].createReadStream());
    const tampered = Buffer.from(body);
    const at = tampered.indexOf(Buffer.from('preserve'));
    expect(at).toBeGreaterThan(0);
    tampered[at] = 88;
    const bad = [...owners];
    bad[0] = {
      ...owners[0],
      createReadStream: () => Readable.from([tampered]),
    };
    await expect(
      new AccountExportArtifactBuilderService().build({
        appId: 'client-interface',
        accountId,
        owners: bad,
        expectedSourcesByOwner: expected,
        spoolRoot: root,
      })
    ).rejects.toThrow();
    expect(
      (await readdir(root)).filter((name) =>
        name.startsWith('ot-account-export-')
      )
    ).toEqual([]);
    const artifact = await new AccountExportArtifactBuilderService().build({
      appId: 'local-hub',
      accountId,
      owners,
      expectedSourcesByOwner: expected,
      spoolRoot: root,
    });
    const files = await readdir(root, { recursive: true, withFileTypes: true });
    expect(files.filter((file) => file.isFile())).toEqual([]);
    await expect(
      artifact.readChunk(artifact.metadata.sizeBytes, 1)
    ).rejects.toThrow('ARTIFACT_INVALID_RANGE');
    await artifact.cleanup();
    await artifact.cleanup();
    expect(
      (await readdir(root)).filter((name) =>
        name.startsWith('ot-account-export-')
      )
    ).toEqual([]);
  });
  it('assembles actual owned image and portable HLS bytes with independent TAR digests', async () => {
    const profileId = randomUUID(),
      imageId = randomUUID(),
      segmentId = randomUUID(),
      playlistId = randomUUID();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=',
      'base64'
    );
    const segment = Buffer.alloc(188 * 3);
    segment[0] = 0x47;
    segment[188] = 0x47;
    segment[376] = 0x47;
    const playlist = Buffer.from(
      `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:5.0,\n/api/asset/${segmentId}\n#EXT-X-ENDLIST\n`
    );
    const digest = (body: Buffer) =>
      createHash('sha256').update(body).digest('hex');
    const mediaRows: Array<{
      source: 'assetMedia';
      data: Record<string, unknown>;
    }> = [];
    for (const [assetId, body, extension, mimeType] of [
      [imageId, png, '.png', 'image/png'],
      [segmentId, segment, '.ts', 'video/mp2t'],
      [playlistId, playlist, '.m3u8', 'application/vnd.apple.mpegurl'],
    ] as const) {
      mediaRows.push({
        source: 'assetMedia',
        data: {
          id: `${profileId}:${assetId}:000000000000`,
          kind: 'bytes',
          assetId,
          profileId,
          offset: 0,
          bytesBase64: body.toString('base64'),
        },
      });
      mediaRows.push({
        source: 'assetMedia',
        data: {
          id: `${profileId}:${assetId}:manifest`,
          kind: 'manifest',
          assetId,
          profileId,
          fileName: assetId + extension,
          mimeType,
          sizeBytes: body.length,
          sha256: digest(body),
          validation:
            extension === '.m3u8'
              ? 'signature-and-owned-hls-references'
              : 'signature',
          ...(extension === '.m3u8'
            ? { hlsReferenceAssetIds: [segmentId] }
            : {}),
        },
      });
    }
    mediaRows.sort((a, b) =>
      String(a.data['id']).localeCompare(String(b.data['id']))
    );
    for (const owner of ACCOUNT_EXPORT_RELEASE_OWNERS) {
      if (owner !== 'assets') {
        owners.push(await capture(owner, root));
        continue;
      }
      owners.push(
        await new AccountExportOwnerSpoolService().capture(
          {
            participantId: owner,
            accountId,
            sources: ['assetMedia'],
            spoolRoot: root,
          },
          async (sink, signal) => {
            const emitter = new AccountExportOwnerEmitter(
              {
                participantId: owner,
                accountId,
                captureId: randomUUID(),
                snapshotAt: '2026-10-24T12:00:00.000Z',
                sources: ['assetMedia'],
                signal,
              },
              sink
            );
            await emitter.emitSources({
              assetMedia: async function* () {
                yield* mediaRows;
              },
            });
            return emitter.complete();
          }
        )
      );
    }
    const artifact = await new AccountExportArtifactBuilderService().build({
      appId: 'local-hub',
      accountId,
      owners,
      expectedSourcesByOwner: { ...expected, assets: ['assetMedia'] },
      spoolRoot: root,
    });
    try {
      const tar = await bytes(artifact.createReadStream()),
        entries = parseTar(tar);
      expect(entries.get(`media/${imageId}.png`)).toEqual(png);
      expect(entries.get(`media/${segmentId}.ts`)).toEqual(segment);
      const portable = entries.get(`media/${playlistId}.m3u8`)!;
      expect(portable.toString()).toContain(`${segmentId}.ts`);
      expect(portable.toString()).not.toContain('/api/asset/');
      const manifest = JSON.parse(entries.get('manifest.json')!.toString());
      for (const entry of manifest.media) {
        const body = entries.get('media/' + entry.fileName)!;
        expect(body.length).toBe(entry.sizeBytes);
        expect(digest(body)).toBe(entry.sha256);
      }
      expect(
        manifest.media.find(
          (item: { assetId: string }) => item.assetId === playlistId
        ).sourceSha256
      ).toBe(digest(playlist));
      expect(digest(tar)).toBe(artifact.metadata.sha256);
      expect(
        (await readdir(root, { recursive: true, withFileTypes: true })).filter(
          (entry) => entry.isFile()
        )
      ).toEqual([]);
    } finally {
      await artifact.cleanup();
    }
  });
});
