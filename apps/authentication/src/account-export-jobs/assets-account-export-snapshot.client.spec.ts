import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientProxy } from '@nestjs/microservices';
import {
  ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  AssetCommands,
} from '@optimistic-tanuki/constants';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  AccountExportSnapshotPullService,
} from '@optimistic-tanuki/storage';
import { of, throwError } from 'rxjs';
import { AssetsAccountExportSnapshotClient } from './assets-account-export-snapshot.client';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const ACCOUNT = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const grant = {
  accountId: ACCOUNT,
  appId: 'client-interface',
  token: 'unit-session',
  jobId: 'f1384460-a162-49d4-89a0-5f7a07d8bd06',
  attempt: 1,
  leaseOwner: 'd59f45d5-d63a-4b29-b3b0-5d8377fe77a1',
};

describe('AssetsAccountExportSnapshotClient', () => {
  let root: string;
  let chunks: AccountExportOwnerChunk<string>[];
  let bytes: Buffer;
  let parent: any;
  let descriptor: any;
  let send: jest.Mock;
  let client: AssetsAccountExportSnapshotClient;
  let renew: jest.Mock;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'auth-assets-snapshot-'));
    chunks = [];
    const captureId = randomUUID();
    const snapshotAt = '2026-10-20 09:00:00.123456+00';
    const emitter = new AccountExportOwnerEmitter(
      {
        participantId: 'assets',
        accountId: ACCOUNT,
        captureId,
        snapshotAt,
        sources: ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    const streams: Record<string, () => AsyncGenerator<any>> = {};
    for (const source of ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES)
      streams[source] = async function* () {
        /* all canonical streams are empty */
      };
    await emitter.emitSources(streams as any);
    await emitter.complete(
      Object.fromEntries(
        ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 'retained'])
      )
    );
    bytes = Buffer.from(
      chunks.map((chunk) => JSON.stringify(chunk)).join('\n') + '\n'
    );
    parent = {
      handleId: randomUUID(),
      participantId: 'profile',
      accountId: ACCOUNT,
      captureId: randomUUID(),
      snapshotAt,
      sizeBytes: 10,
      sha256: 'a'.repeat(64),
      rowCount: 0,
      sources: ['profileIdentity'],
      sourceRowCounts: { profileIdentity: 0 },
      sourceDispositions: { profileIdentity: 'retained' },
      identityCount: 0,
      expiresAt: '2026-10-20T09:02:00.000Z',
    };
    descriptor = {
      handleId: randomUUID(),
      participantId: 'assets',
      accountId: ACCOUNT,
      captureId,
      snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 0,
      sources: [...ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      sourceRowCounts: Object.fromEntries(
        ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 0])
      ),
      sourceDispositions: Object.fromEntries(
        ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 'retained'])
      ),
      identityCount: 0,
      expiresAt: '2026-10-20T09:02:00.000Z',
      profileHandleId: parent.handleId,
      profileCaptureId: parent.captureId,
      profileSnapshotAt: parent.snapshotAt,
    };
    send = jest.fn((pattern: any, payload: any) => {
      if (pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE)
        return of(descriptor);
      if (pattern.cmd === AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE)
        return of({
          handleId: descriptor.handleId,
          captureId: descriptor.captureId,
          offset: payload.offset,
          bytesBase64: bytes
            .subarray(payload.offset, payload.offset + payload.length)
            .toString('base64'),
          eof: payload.offset + payload.length === bytes.length,
        });
      return of({ released: true });
    });
    const spool = new AccountExportOwnerSpoolService();
    const actualCapture = spool.capture.bind(spool);
    jest
      .spyOn(spool, 'capture')
      .mockImplementation(((options: any, producer: any) =>
        actualCapture({ ...options, spoolRoot: root }, producer)) as any);
    client = new AssetsAccountExportSnapshotClient(
      { send } as unknown as ClientProxy,
      new AccountExportSnapshotPullService(spool)
    );
    renew = jest.fn().mockResolvedValue(true);
  });

  afterEach(async () => {
    await expectNoCaptureFd(root);
    await rm(root, { recursive: true, force: true });
  });

  it('pulls a real empty three-source capture bound to the exact Profile snapshot', async () => {
    expect(ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES).toEqual([
      'asset',
      'assetMedia',
      'guardianActivity',
    ]);
    const capture = await client.capture(grant, parent, renew);
    expect(capture.handle.metadata).toMatchObject({
      participantId: 'assets',
      rowCount: 0,
    });
    expect(capture.descriptor).toMatchObject({
      profileHandleId: parent.handleId,
      profileCaptureId: parent.captureId,
      profileSnapshotAt: parent.snapshotAt,
    });
    const openPayload = send.mock.calls.find(
      (call) => call[0].cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
    )![1];
    expect(openPayload).toMatchObject({ ...grant, profileSnapshot: parent });
    await capture.cleanup();
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it.each([
    ['participant', { participantId: 'other' }],
    ['account', { accountId: randomUUID() }],
    ['handle UUID', { handleId: 'bad-id' }],
    ['capture UUID', { captureId: 'bad-id' }],
    ['timestamp', { snapshotAt: 'invalid' }],
    ['identity count bound', { identityCount: Number.MAX_SAFE_INTEGER }],
  ])(
    'rejects invalid parent metadata before RPC (%s)',
    async (_label, patch) => {
      await expect(
        client.capture(grant, { ...parent, ...patch }, renew)
      ).rejects.toBeDefined();
      expect(send).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['wrong participant', { participantId: 'profile' }],
    ['wrong account', { accountId: randomUUID() }],
    ['wrong Profile handle', { profileHandleId: randomUUID() }],
    ['wrong Profile capture', { profileCaptureId: randomUUID() }],
    [
      'wrong Profile timestamp',
      { profileSnapshotAt: '2026-10-20T09:01:00.000Z' },
    ],
    ['identity rows present', { identityCount: 1 }],
  ])('rejects opened descriptor with %s', async (_label, patch) => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of({ ...descriptor, ...patch })
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('renews before open and each read, stopping when the read renewal fails', async () => {
    renew.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(renew).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('uses cloned grant and parent metadata after the caller mutates inputs during renewal', async () => {
    let resolveRenew!: (value: boolean) => void;
    let renewalCount = 0;
    renew.mockImplementation(() => {
      renewalCount += 1;
      return renewalCount === 1
        ? new Promise<boolean>((resolve) => {
            resolveRenew = resolve;
          })
        : Promise.resolve(true);
    });
    const inputGrant = { ...grant };
    const inputParent = { ...parent };
    const pending = client.capture(inputGrant, inputParent, renew);
    inputGrant.token = 'mutated-token';
    inputParent.handleId = randomUUID();
    inputParent.sourceRowCounts.profileIdentity = 17;
    resolveRenew(true);
    const capture = await pending;
    const payload = send.mock.calls.find(
      (call) => call[0].cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
    )![1];
    expect(payload.token).toBe(grant.token);
    expect(payload.profileSnapshot.handleId).toBe(parent.handleId);
    expect(payload.profileSnapshot.sourceRowCounts).toEqual({
      profileIdentity: 0,
    });
    await capture.cleanup();
  });

  it('does no RPC when initial lease renewal fails', async () => {
    renew.mockResolvedValue(false);
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['bad handle', (d: any) => ({ ...d, handleId: 'not-a-uuid' })],
    ['wrong source set', (d: any) => ({ ...d, sources: ['asset'] })],
    ['bad digest', (d: any) => ({ ...d, sha256: 'z'.repeat(64) })],
  ])('rejects malformed descriptor (%s)', async (_label, mutate) => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of((mutate as any)(descriptor))
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects wrong read handle and releases the remote capture', async () => {
    send.mockImplementation((pattern: any, payload: any) =>
      pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of(descriptor)
        : pattern.cmd === AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE
        ? of({
            handleId: randomUUID(),
            captureId: descriptor.captureId,
            offset: payload.offset,
            bytesBase64: bytes
              .subarray(payload.offset, payload.offset + payload.length)
              .toString('base64'),
            eof: payload.offset + payload.length === bytes.length,
          })
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects a valid-format digest that does not match the pulled bytes', async () => {
    send.mockImplementation((pattern: any, payload: any) =>
      pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of({ ...descriptor, sha256: '0'.repeat(64) })
        : pattern.cmd === AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE
        ? of({
            handleId: descriptor.handleId,
            captureId: descriptor.captureId,
            offset: payload.offset,
            bytesBase64: bytes
              .subarray(payload.offset, payload.offset + payload.length)
              .toString('base64'),
            eof: payload.offset + payload.length === bytes.length,
          })
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects an end chunk whose row count disagrees with the capture descriptor', async () => {
    const alteredChunks = chunks.map((chunk) => ({ ...chunk })) as any[];
    alteredChunks[alteredChunks.length - 1].rowCount = 1;
    const altered = Buffer.from(
      alteredChunks.map((chunk) => JSON.stringify(chunk)).join('\n') + '\n'
    );
    const alteredDescriptor = {
      ...descriptor,
      rowCount: 1,
      sha256: createHash('sha256').update(altered).digest('hex'),
      sizeBytes: altered.length,
    };
    send.mockImplementation((pattern: any, payload: any) =>
      pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of(alteredDescriptor)
        : pattern.cmd === AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE
        ? of({
            handleId: alteredDescriptor.handleId,
            captureId: alteredDescriptor.captureId,
            offset: payload.offset,
            bytesBase64: altered
              .subarray(payload.offset, payload.offset + payload.length)
              .toString('base64'),
            eof: payload.offset + payload.length === altered.length,
          })
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toBeDefined();
    expect(await readdir(root)).toEqual([]);
  });

  it('suppresses read errors and releases failed remote captures', async () => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of(descriptor)
        : pattern.cmd === AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE
        ? throwError(() => new Error('secret rpc text'))
        : of({ released: true })
    );
    const error = await client.capture(grant, parent, renew).then(
      () => new Error('unexpected success'),
      (e) => e as Error
    );
    expect(error.message).toBe('ASSETS_SNAPSHOT_UNAVAILABLE');
    expect(error.message).not.toContain('secret');
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('closes the local spool even when remote release fails', async () => {
    const capture = await client.capture(grant, parent, renew);
    send.mockImplementation((pattern: any) =>
      pattern.cmd === AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
        ? throwError(() => new Error('secret release text'))
        : of({})
    );
    await expect(capture.cleanup()).rejects.toBeDefined();
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    expect(await readdir(root)).toEqual([]);
  });

  it('closes the spool and propagates a local cleanup failure', async () => {
    // The API exposes cleanup; the injected failure occurs after the real FD has closed.
    const originalCapture = (client as any).pull.capture.bind(
      (client as any).pull
    );
    jest
      .spyOn((client as any).pull, 'capture')
      .mockImplementation(async (options: any) => {
        const real = await originalCapture(options);
        const originalCleanup = real.cleanup.bind(real);
        real.cleanup = async () => {
          await originalCleanup();
          throw new Error('private local detail');
        };
        return real;
      });
    const capture = await client.capture(grant, parent, renew);
    await expect(capture.cleanup()).rejects.toBeDefined();
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    expect(await readdir(root)).toEqual([]);
  });
});

async function expectNoCaptureFd(root: string): Promise<void> {
  try {
    const fds = await readdir('/proc/self/fd');
    const targets = await Promise.all(
      fds.map(async (fd) => {
        try {
          return await readlink(`/proc/self/fd/${fd}`);
        } catch {
          return '';
        }
      })
    );
    expect(
      targets.filter((target) =>
        target.startsWith(join(root, 'ot-owner-spool-'))
      )
    ).toEqual([]);
  } catch {
    /* /proc is unavailable on some supported hosts */
  }
}
