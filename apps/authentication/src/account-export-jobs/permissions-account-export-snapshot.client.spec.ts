import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientProxy } from '@nestjs/microservices';
import {
  PermissionCommands,
  PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  AccountExportSnapshotPullService,
} from '@optimistic-tanuki/storage';
import { of, throwError } from 'rxjs';
import { PermissionsAccountExportSnapshotClient } from './permissions-account-export-snapshot.client';

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

describe('PermissionsAccountExportSnapshotClient', () => {
  let root: string;
  let bytes: Buffer;
  let parent: any;
  let descriptor: any;
  let send: jest.Mock;
  let client: PermissionsAccountExportSnapshotClient;
  let renew: jest.Mock;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'auth-permissions-snapshot-'));
    const chunks: AccountExportOwnerChunk<string>[] = [];
    const captureId = randomUUID();
    const snapshotAt = '2026-10-20 09:00:00.123456+00';
    const emitter = new AccountExportOwnerEmitter(
      {
        participantId: 'permissions',
        accountId: ACCOUNT,
        captureId,
        snapshotAt,
        sources: PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    const streams: Record<string, () => AsyncGenerator<any>> = {};
    for (const source of PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES)
      streams[source] = async function* () {
        /* canonical streams are empty */
      };
    await emitter.emitSources(streams as any);
    await emitter.complete(
      Object.fromEntries(
        PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 'retained'])
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
      participantId: 'permissions',
      accountId: ACCOUNT,
      captureId,
      snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 0,
      sources: [...PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      sourceRowCounts: Object.fromEntries(
        PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 0])
      ),
      sourceDispositions: Object.fromEntries(
        PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 'retained'])
      ),
      identityCount: 0,
      expiresAt: '2026-10-20T09:02:00.000Z',
      profileHandleId: parent.handleId,
      profileCaptureId: parent.captureId,
      profileSnapshotAt: parent.snapshotAt,
    };
    send = jest.fn((pattern: any, payload: any) => {
      if (pattern.cmd === PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE)
        return of(descriptor);
      if (pattern.cmd === PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE)
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
    client = new PermissionsAccountExportSnapshotClient(
      { send } as unknown as ClientProxy,
      new AccountExportSnapshotPullService(spool)
    );
    renew = jest.fn().mockResolvedValue(true);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('pulls a capture pinned to the exact Profile descriptor', async () => {
    const capture = await client.capture(grant, parent, renew);
    expect(capture.handle.metadata).toMatchObject({
      participantId: 'permissions',
      rowCount: 0,
    });
    expect(capture.descriptor).toMatchObject({
      profileHandleId: parent.handleId,
      profileCaptureId: parent.captureId,
      profileSnapshotAt: parent.snapshotAt,
    });
    const opened = send.mock.calls.find(
      (call) => call[0].cmd === PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
    )![1];
    expect(opened.profileSnapshot).toEqual(parent);
    expect(
      send.mock.calls.some(
        (call) => call[0].cmd === PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE
      )
    ).toBe(true);
    expect(renew).toHaveBeenCalled();
    await capture.cleanup();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      PermissionCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('rejects a foreign Profile binding and releases its known remote handle', async () => {
    const foreign = { ...descriptor, profileCaptureId: randomUUID() };
    send.mockImplementation((pattern: any) =>
      pattern.cmd === PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? of(foreign)
        : of({ released: true })
    );
    const error = await client.capture(grant, parent, renew).then(
      () => new Error('unexpected success'),
      (e) => e as Error
    );
    expect(error.message).toBe('PERMISSIONS_SNAPSHOT_UNAVAILABLE');
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      PermissionCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('closes the local spool when remote release fails and keeps the error stable', async () => {
    const capture = await client.capture(grant, parent, renew);
    send.mockImplementation((pattern: any) =>
      pattern.cmd === PermissionCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
        ? throwError(() => new Error('private permissions service detail'))
        : of({})
    );
    const error = await capture.cleanup().then(
      () => undefined,
      (e) => e as Error
    );
    expect(error?.message).toBe('PERMISSIONS_SNAPSHOT_UNAVAILABLE');
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    await expect(readdir(root)).resolves.toEqual([]);
  });
});
