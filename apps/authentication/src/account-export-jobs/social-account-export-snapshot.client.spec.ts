import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientProxy } from '@nestjs/microservices';
import {
  SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  SocialCommands,
} from '@optimistic-tanuki/constants';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  AccountExportSnapshotPullService,
} from '@optimistic-tanuki/storage';
import { of, throwError } from 'rxjs';
import { SocialAccountExportSnapshotClient } from './social-account-export-snapshot.client';

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

describe('SocialAccountExportSnapshotClient', () => {
  let root: string;
  let bytes: Buffer;
  let parent: any;
  let descriptor: any;
  let send: jest.Mock;
  let client: SocialAccountExportSnapshotClient;
  let renew: jest.Mock;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'auth-social-snapshot-'));
    const chunks: AccountExportOwnerChunk<string>[] = [];
    const captureId = randomUUID();
    const snapshotAt = '2026-10-20 09:00:00.123456+00';
    const emitter = new AccountExportOwnerEmitter(
      {
        participantId: 'social',
        accountId: ACCOUNT,
        captureId,
        snapshotAt,
        sources: SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    const streams: Record<string, () => AsyncGenerator<any>> = {};
    for (const source of SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES)
      streams[source] = async function* () {
        /* canonical streams are empty */
      };
    await emitter.emitSources(streams as any);
    await emitter.complete(
      Object.fromEntries(
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
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
      participantId: 'social',
      accountId: ACCOUNT,
      captureId,
      snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 0,
      sources: [...SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      sourceRowCounts: Object.fromEntries(
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [source, 0])
      ),
      sourceDispositions: Object.fromEntries(
        SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
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
      if (pattern.cmd === SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE)
        return of(descriptor);
      if (pattern.cmd === SocialCommands.READ_ACCOUNT_EXPORT_CAPTURE)
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
    client = new SocialAccountExportSnapshotClient(
      { send } as unknown as ClientProxy,
      new AccountExportSnapshotPullService(spool)
    );
    renew = jest.fn().mockResolvedValue(true);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('verifies all 33 sources and pins the capture to the exact Profile snapshot', async () => {
    const capture = await client.capture(grant, parent, renew);
    expect(capture.descriptor.sources).toEqual(
      SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES
    );
    expect(capture.descriptor.sha256).toBe(descriptor.sha256);
    expect(capture.descriptor.profileHandleId).toBe(parent.handleId);
    expect(capture.descriptor.profileCaptureId).toBe(parent.captureId);
    expect(capture.descriptor.profileSnapshotAt).toBe(parent.snapshotAt);
    expect(JSON.stringify(capture.descriptor)).not.toContain(grant.token);
    expect(send).toHaveBeenCalledWith(
      { cmd: SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
      expect.objectContaining({ profileSnapshot: parent, ...grant })
    );
    expect(renew).toHaveBeenCalled();
    await capture.cleanup();
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      SocialCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('fails closed when the pulled snapshot digest is invalid and releases the remote handle', async () => {
    descriptor = { ...descriptor, sha256: 'b'.repeat(64) };
    await expect(client.capture(grant, parent, renew)).rejects.toMatchObject({
      message: 'SOCIAL_SNAPSHOT_UNAVAILABLE',
    });
    expect(send.mock.calls.map((call) => call[0].cmd)).toContain(
      SocialCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE
    );
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('maps remote RPC failures to the stable Social snapshot error', async () => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === SocialCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? throwError(() => new Error('private Social service detail'))
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toMatchObject({
      message: 'SOCIAL_SNAPSHOT_UNAVAILABLE',
    });
    await expect(readdir(root)).resolves.toEqual([]);
  });
});
