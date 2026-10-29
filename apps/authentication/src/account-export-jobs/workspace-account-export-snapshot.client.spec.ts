import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientProxy } from '@nestjs/microservices';
import {
  WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  AccountExportSnapshotPullService,
} from '@optimistic-tanuki/storage';
import { of, throwError } from 'rxjs';
import { WorkspaceAccountExportSnapshotClient } from './workspace-account-export-snapshot.client';

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

describe('WorkspaceAccountExportSnapshotClient', () => {
  let root: string;
  let bytes: Buffer;
  let parent: any;
  let descriptor: any;
  let send: jest.Mock;
  let client: WorkspaceAccountExportSnapshotClient;
  let renew: jest.Mock;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'auth-workspace-snapshot-'));
    const chunks: AccountExportOwnerChunk<string>[] = [];
    const captureId = randomUUID();
    const snapshotAt = '2026-10-20 09:00:00.123456+00';
    const emitter = new AccountExportOwnerEmitter(
      {
        participantId: 'workspace',
        accountId: ACCOUNT,
        captureId,
        snapshotAt,
        sources: WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    const streams: Record<string, () => AsyncGenerator<any>> = {};
    for (const source of WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES)
      streams[source] = async function* () {
        /* canonical streams are empty */
      };
    await emitter.emitSources(streams as any);
    await emitter.complete(
      Object.fromEntries(
        WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
          source,
          'retained',
        ])
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
      participantId: 'workspace',
      accountId: ACCOUNT,
      captureId,
      snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 0,
      sources: [...WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      sourceRowCounts: Object.fromEntries(
        WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [source, 0])
      ),
      sourceDispositions: Object.fromEntries(
        WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
          source,
          'retained',
        ])
      ),
      identityCount: 0,
      expiresAt: '2026-10-20T09:02:00.000Z',
      profileHandleId: parent.handleId,
      profileCaptureId: parent.captureId,
      profileSnapshotAt: parent.snapshotAt,
    };
    send = jest.fn((pattern: any, payload: any) => {
      if (pattern.cmd === WorkspaceCommands.OPEN_ACCOUNT_EXPORT_CAPTURE)
        return of(descriptor);
      if (pattern.cmd === WorkspaceCommands.READ_ACCOUNT_EXPORT_CAPTURE)
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
    const capture = spool.capture.bind(spool);
    jest
      .spyOn(spool, 'capture')
      .mockImplementation(((options: any, producer: any) =>
        capture({ ...options, spoolRoot: root }, producer)) as any);
    client = new WorkspaceAccountExportSnapshotClient(
      { send } as unknown as ClientProxy,
      new AccountExportSnapshotPullService(spool)
    );
    renew = jest.fn().mockResolvedValue(true);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('verifies the Workspace source and pins the capture to the exact Profile snapshot', async () => {
    const capture = await client.capture(grant, parent, renew);
    expect(capture.descriptor.sources).toEqual(
      WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    expect(capture.descriptor.sha256).toBe(descriptor.sha256);
    expect(capture.descriptor.profileHandleId).toBe(parent.handleId);
    expect(capture.descriptor.profileCaptureId).toBe(parent.captureId);
    expect(capture.descriptor.profileSnapshotAt).toBe(parent.snapshotAt);
    expect(JSON.stringify(capture.descriptor)).not.toContain(grant.token);
    expect(send).toHaveBeenCalledWith(
      { cmd: WorkspaceCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
      expect.objectContaining({ profileSnapshot: parent, ...grant })
    );
    expect(renew).toHaveBeenCalled();
    await capture.cleanup();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      WorkspaceCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('fails closed when the pulled snapshot digest is invalid and releases the remote handle', async () => {
    descriptor = { ...descriptor, sha256: 'b'.repeat(64) };
    await expect(client.capture(grant, parent, renew)).rejects.toMatchObject({
      message: 'WORKSPACE_SNAPSHOT_UNAVAILABLE',
    });
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      WorkspaceCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('maps remote RPC failures to the stable Workspace snapshot error', async () => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === WorkspaceCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? throwError(() => new Error('private Workspace service detail'))
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toMatchObject({
      message: 'WORKSPACE_SNAPSHOT_UNAVAILABLE',
    });
    await expect(readdir(root)).resolves.toEqual([]);
  });
});
