import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClientProxy } from '@nestjs/microservices';
import {
  APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  AppConfigCommands,
} from '@optimistic-tanuki/constants';
import { AccountExportOwnerChunk } from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  AccountExportSnapshotPullService,
} from '@optimistic-tanuki/storage';
import { of, throwError } from 'rxjs';
import { AppConfiguratorAccountExportSnapshotClient } from './app-configurator-account-export-snapshot.client';

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

describe('AppConfiguratorAccountExportSnapshotClient', () => {
  let root: string;
  let bytes: Buffer;
  let parent: any;
  let descriptor: any;
  let send: jest.Mock;
  let client: AppConfiguratorAccountExportSnapshotClient;
  let renew: jest.Mock;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'auth-app-configurator-snapshot-'));
    const chunks: AccountExportOwnerChunk<string>[] = [];
    const captureId = randomUUID();
    const snapshotAt = '2026-10-20 09:00:00.123456+00';
    const emitter = new AccountExportOwnerEmitter(
      {
        participantId: 'app-configurator',
        accountId: ACCOUNT,
        captureId,
        snapshotAt,
        sources: APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      },
      async (chunk) => {
        chunks.push(chunk);
      }
    );
    const streams: Record<string, () => AsyncGenerator<any>> = {};
    for (const source of APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES)
      streams[source] = async function* () {
        /* canonical streams are empty */
      };
    await emitter.emitSources(streams as any);
    await emitter.complete(
      Object.fromEntries(
        APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
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
      participantId: 'app-configurator',
      accountId: ACCOUNT,
      captureId,
      snapshotAt,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rowCount: 0,
      sources: [...APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES],
      sourceRowCounts: Object.fromEntries(
        APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
          source,
          0,
        ])
      ),
      sourceDispositions: Object.fromEntries(
        APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES.map((source) => [
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
      if (pattern.cmd === AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE)
        return of(descriptor);
      if (pattern.cmd === AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE)
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
    client = new AppConfiguratorAccountExportSnapshotClient(
      { send } as unknown as ClientProxy,
      new AccountExportSnapshotPullService(spool)
    );
    renew = jest.fn().mockResolvedValue(true);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('pulls the leased snapshot into a private spool and releases it on cleanup', async () => {
    const capture = await client.capture(grant, parent, renew);
    expect(send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE },
      expect.objectContaining({
        accountId: ACCOUNT,
        token: grant.token,
        jobId: grant.jobId,
      })
    );
    expect(capture.descriptor.participantId).toBe('app-configurator');
    expect(capture.handle.metadata.participantId).toBe('app-configurator');
    await capture.cleanup();
    expect(send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE },
      expect.any(Object)
    );
    expect(await readdir(root)).toEqual([]);
  });

  it('hides RPC failures and removes partial spool data', async () => {
    send.mockImplementation((pattern: any) =>
      pattern.cmd === AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE
        ? throwError(() => new Error('private app-configurator detail'))
        : of({ released: true })
    );
    await expect(client.capture(grant, parent, renew)).rejects.toMatchObject({
      message: 'APP_CONFIGURATOR_SNAPSHOT_UNAVAILABLE',
    });
    expect(await readdir(root)).toEqual([]);
  });
});
