import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir, readlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProfileCommands,
  PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  AccountExportSnapshotPullService,
} from '@optimistic-tanuki/storage';
import { of, throwError } from 'rxjs';
import { ProfileAccountExportSnapshotClient } from './profile-account-export-snapshot.client';

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
const PROFILE_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
];

describe('ProfileAccountExportSnapshotClient', () => {
  let root: string;
  let chunks: AccountExportOwnerChunk<string>[];
  let bytes: Buffer;
  let descriptor: any;
  let send: jest.Mock;
  let client: ProfileAccountExportSnapshotClient;
  let renew: jest.Mock;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'auth-profile-snapshot-'));
    chunks = [];
    const emitter = new AccountExportOwnerEmitter(
      {
        participantId: 'profile',
        accountId: ACCOUNT,
        captureId: randomUUID(),
        snapshotAt: '2026-10-20 09:00:00.123456+00',
        sources: PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    const streams: Record<string, () => AsyncGenerator<any>> = {};
    for (const source of PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES)
      streams[source] = async function* () {
        if (source === 'profileIdentity')
          for (const id of PROFILE_IDS)
            yield { source, data: { id, userId: ACCOUNT } };
      };
    await emitter.emitSources(streams as any);
    await emitter.complete(
      Object.fromEntries(
        PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 'retained'])
      )
    );
    bytes = Buffer.from(chunks.map((c) => JSON.stringify(c)).join('\n') + '\n');
    descriptor = {
      handleId: randomUUID(),
      participantId: 'profile',
      accountId: ACCOUNT,
      captureId: chunks[0].captureId,
      snapshotAt: chunks[0].snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 2,
      sources: [...PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      sourceRowCounts: Object.fromEntries(
        PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [
          s,
          s === 'profileIdentity' ? 2 : 0,
        ])
      ),
      sourceDispositions: Object.fromEntries(
        PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((s) => [s, 'retained'])
      ),
      identityCount: 2,
      expiresAt: '2026-10-20T09:02:00.000Z',
    };
    send = jest.fn((pattern: any, payload: any) => {
      const cmd = pattern.cmd;
      if (cmd === ProfileCommands.OpenAccountExportCapture)
        return of(descriptor);
      if (cmd === ProfileCommands.ReadAccountExportCapture)
        return of({
          handleId: descriptor.handleId,
          captureId: descriptor.captureId,
          offset: payload.offset,
          bytesBase64: bytes
            .subarray(payload.offset, payload.offset + payload.length)
            .toString('base64'),
          eof: payload.offset + payload.length === bytes.length,
        });
      if (cmd === ProfileCommands.ReadAccountExportCaptureIdentities) {
        const end = Math.min(
          payload.offset + payload.limit,
          descriptor.identityCount
        );
        return of({
          handleId: descriptor.handleId,
          captureId: descriptor.captureId,
          accountId: ACCOUNT,
          snapshotAt: descriptor.snapshotAt,
          profileIds: PROFILE_IDS.slice(payload.offset, end),
          total: 2,
          nextOffset: end < 2 ? end : null,
        });
      }
      return of({ released: true });
    });
    const spool = new AccountExportOwnerSpoolService();
    const actualCapture = spool.capture.bind(spool);
    jest
      .spyOn(spool, 'capture')
      .mockImplementation(((opts: any, producer: any) =>
        actualCapture({ ...opts, spoolRoot: root }, producer)) as any);
    client = new ProfileAccountExportSnapshotClient(
      { send } as unknown as ClientProxy,
      new AccountExportSnapshotPullService(spool)
    );
    renew = jest.fn().mockResolvedValue(true);
  });
  afterEach(async () => {
    await expectNoCaptureFd(root);
    await rm(root, { recursive: true, force: true });
  });

  it('captures actual emitted JSONL, pages identities, and releases remote and local resources', async () => {
    expect(PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES).toEqual([
      'profileIdentity',
      'profileMedia',
      'profileText',
      'timelineText',
      'profile',
      'timeline',
      'guardianActivity',
      'legacyGoalText',
      'legacyGoal',
      'legacyProjectText',
      'legacyProject',
    ]);
    const capture = await client.capture(grant, renew);
    expect(capture.descriptor.snapshotAt).toBe('2026-10-20 09:00:00.123456+00');
    expect((await capture.identities(0, 1)).profileIds).toEqual(
      PROFILE_IDS.slice(0, 1)
    );
    await capture.cleanup();
    expect(send.mock.calls.map((c) => c[0].cmd)).toContain(
      ProfileCommands.ReleaseAccountExportCapture
    );
    await expect(capture.handle.readChunk(0, 1)).rejects.toBeDefined();
    expect(await readdir(root)).toEqual([]);
  });

  it('does no RPC when the initial lease renewal fails', async () => {
    renew.mockResolvedValue(false);
    await expect(client.capture(grant, renew)).rejects.toBeDefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('releases the remote capture when lease renewal fails before a read', async () => {
    renew.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(client.capture(grant, renew)).rejects.toBeDefined();
    expect(send.mock.calls.map((c) => c[0].cmd)).toContain(
      ProfileCommands.ReleaseAccountExportCapture
    );
    expect(await readdir(root)).toEqual([]);
  });

  it.each([
    ['wrong capture', (d: any) => ({ ...d, captureId: randomUUID() })],
    ['wrong identity total', (d: any) => ({ ...d, identityCount: 3 })],
    ['bad size', (d: any) => ({ ...d, sizeBytes: 0 })],
  ])('rejects malformed descriptor: %s', async (_name, mutate) => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === ProfileCommands.OpenAccountExportCapture
        ? of((mutate as any)(descriptor))
        : of({})
    );
    await expect(client.capture(grant, renew)).rejects.toBeDefined();
    expect(send.mock.calls.map((c) => c[0].cmd)).toContain(
      ProfileCommands.ReleaseAccountExportCapture
    );
  });

  it.each([
    ['wrong identity capture', { captureId: randomUUID() }],
    ['wrong total', { total: 3 }],
    ['wrong next offset', { nextOffset: 2 }],
    ['malformed identity UUID', { profileIds: ['not-a-uuid'] }],
    ['unordered identities', { profileIds: [...PROFILE_IDS].reverse() }],
  ])('rejects malformed identity page: %s', async (_name, patch) => {
    const capture = await client.capture(grant, renew);
    send.mockImplementation((pattern: any, payload: any) =>
      pattern.cmd === ProfileCommands.ReadAccountExportCaptureIdentities
        ? of({
            handleId: descriptor.handleId,
            captureId: descriptor.captureId,
            accountId: ACCOUNT,
            snapshotAt: descriptor.snapshotAt,
            profileIds: PROFILE_IDS,
            total: 2,
            nextOffset: null,
            ...(patch as any),
          })
        : of({})
    );
    await expect(capture.identities(0, 2)).rejects.toBeDefined();
    await capture.cleanup();
  });

  it('suppresses read RPC details and releases failed captures', async () => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === ProfileCommands.OpenAccountExportCapture
        ? of(descriptor)
        : pattern.cmd === ProfileCommands.ReadAccountExportCapture
        ? throwError(() => new Error('secret rpc text'))
        : of({})
    );
    const error = await client.capture(grant, renew).then(
      () => new Error('unexpected success'),
      (e) => e as Error
    );
    expect(error.message).toBe('PROFILE_SNAPSHOT_UNAVAILABLE');
    expect(error.message).not.toContain('secret');
    expect(send.mock.calls.map((c) => c[0].cmd)).toContain(
      ProfileCommands.ReleaseAccountExportCapture
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('closes the local handle even when remote cleanup RPC fails', async () => {
    const capture = await client.capture(grant, renew);
    send.mockImplementation((pattern: any) =>
      pattern.cmd === ProfileCommands.ReleaseAccountExportCapture
        ? throwError(() => new Error('secret release text'))
        : of({})
    );
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
