import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import { DataSource, QueryRunner } from 'typeorm';
import { of } from 'rxjs';
import {
  AssetsAccountExportOwnerService,
  AssetsAccountExportOwnerError,
  ASSETS_ACCOUNT_EXPORT_SOURCES,
} from './account-export-owner.service';
import { AssetsAccountExportProfileSnapshotClient } from './account-export-profile-snapshot.client';
import { AssetsAccountExportMediaReader } from './account-export-media-reader';

const accountId = '11111111-1111-4111-8111-111111111111';
const foreignUserId = '22222222-2222-4222-8222-222222222222';
const minUuid = '00000000-0000-0000-0000-000000000000';
const nextUuid = '00000000-0000-0000-0000-000000000001';
const missingAssetId = '00000000-0000-0000-0000-000000000002';
const grant: AccountExportCaptureGrant = {
  accountId,
  appId: 'client-interface',
  token: 'session-token',
  jobId: '33333333-3333-4333-8333-333333333333',
  attempt: 1,
  leaseOwner: '44444444-4444-4444-8444-444444444444',
};
const descriptor: AccountExportSnapshotDescriptor = {
  handleId: '55555555-5555-4555-8555-555555555555',
  participantId: 'profile',
  accountId,
  captureId: '66666666-6666-4666-8666-666666666666',
  snapshotAt: '2026-10-20T12:00:00.000Z',
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  rowCount: 0,
  sources: [],
  sourceRowCounts: {},
  sourceDispositions: {},
  identityCount: 1,
  expiresAt: '2026-10-20T12:02:00.000Z',
};

const activity = (values: Partial<Record<string, unknown>> = {}) => ({
  actorUserId: accountId,
  dependentUserId: accountId,
  profileId: minUuid,
  assetId: '*',
  appId: 'client-interface',
  operation: 'list',
  changedFieldNames: '[]',
  fieldsLength: 2,
  createdAt: '2026-10-20T12:00:00.123456Z',
  actorLength: 36,
  dependentLength: 36,
  profileLength: 36,
  assetLength: 1,
  appLength: 16,
  operationLength: 4,
  ...values,
});

describe('AssetsAccountExportOwnerService', () => {
  let service: AssetsAccountExportOwnerService;
  let runner: QueryRunner;
  let query: jest.Mock;
  let calls: string[];
  let identityRead: jest.Mock;
  let lease: jest.Mock;
  let profileSend: jest.Mock;
  let mediaRead: jest.Mock;
  let ownedProfileIds: string[];
  let assetRows: Record<string, unknown>[];
  let activityRows: Record<string, unknown>[];
  let identityGate: (() => void) | undefined;

  beforeEach(() => {
    calls = [];
    ownedProfileIds = [minUuid];
    assetRows = [];
    activityRows = [];
    identityGate = undefined;
    query = jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push(sql);
      if (sql.includes('transaction_timestamp'))
        return [{ snapshotAt: '2026-10-20 12:00:00.123456+00' }];
      if (sql.includes('SELECT 1 FROM "assets_export_scope_'))
        return [{ '?column?': 1 }];
      if (
        sql.includes('FROM "asset_entity" a JOIN') &&
        (params[0] === null || params[0] === undefined)
      )
        return assetRows;
      if (
        sql.includes('FROM "guardian_asset_activity"') &&
        (params[1] === null || params[1] === undefined)
      )
        return activityRows;
      return [];
    });
    runner = {
      connect: jest.fn(),
      query: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(async () => calls.push('COMMIT')),
      rollbackTransaction: jest.fn(async () => calls.push('ROLLBACK')),
      release: jest.fn(async () => calls.push('RELEASE')),
      releasePostgresConnection: jest.fn(async () => calls.push('EVICT')),
    } as unknown as QueryRunner;
    (runner as any).query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('CREATE TEMP TABLE')) {
        calls.push('CREATE');
        return [];
      }
      if (sql.startsWith('DROP TABLE')) {
        calls.push('DROP');
        return [];
      }
      return query(sql, params);
    });
    identityRead = jest.fn(async (_grant, _descriptor, onPage) => {
      if (identityGate) identityGate();
      await onPage(ownedProfileIds);
      return {
        accountId,
        handleId: descriptor.handleId,
        captureId: descriptor.captureId,
        snapshotAt: descriptor.snapshotAt,
        identityCount: ownedProfileIds.length,
      };
    });
    lease = jest.fn(() => of({ valid: true }));
    profileSend = jest.fn((_pattern, request) =>
      of({
        id: request.id,
        userId: request.id === nextUuid ? foreignUserId : accountId,
      })
    );
    mediaRead = jest.fn(async function* (asset: any) {
      yield {
        source: 'assetMedia',
        data: {
          id: `${asset.profileId}:${asset.id}:manifest`,
          kind: 'manifest',
          assetId: asset.id,
          profileId: asset.profileId,
          fileName: 'safe.png',
          mimeType: 'image/png',
          sizeBytes: 1,
          sha256: 'b'.repeat(64),
          validation: 'signature',
        },
      };
    });
    service = new AssetsAccountExportOwnerService(
      { createQueryRunner: () => runner } as unknown as DataSource,
      {
        readIdentities: identityRead,
      } as unknown as AssetsAccountExportProfileSnapshotClient,
      { read: mediaRead } as unknown as AssetsAccountExportMediaReader,
      { send: lease } as unknown as ClientProxy,
      { send: profileSend } as unknown as ClientProxy
    );
  });

  it('includes minimum UUID asset/profile/activity rows and preserves timestamp precision', async () => {
    assetRows = [
      {
        id: minUuid,
        profileId: minUuid,
        profileIdLength: 36,
        name: 'tiny.png',
        nameLength: 8,
        type: 'image',
        storageStrategy: 'local_block_storage',
        storagePath: '/private/raw/storage/location',
        pathLength: 29,
        originKind: 'ordinary',
        originProfileId: null,
        originAppId: null,
        originAppIdLength: null,
        lifecycleState: 'active',
      },
    ];
    activityRows = [
      activity({ id: minUuid }),
      activity({
        id: nextUuid,
        dependentUserId: foreignUserId,
        profileId: nextUuid,
        profileLength: 36,
        assetId: missingAssetId,
        assetLength: 36,
        operation: 'delete',
        operationLength: 6,
        changedFieldNames: '["name"]',
        fieldsLength: 8,
      }),
    ];
    const chunks: any[] = [];
    const result = await service.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => {
        chunks.push(chunk);
      },
    });
    const metadata = chunks.find((chunk) => chunk.source === 'asset')
      .records[0];
    const activities = chunks.find(
      (chunk) => chunk.source === 'guardianActivity'
    ).records;
    expect(metadata.data.id).toBe(minUuid);
    expect(JSON.stringify(metadata)).not.toContain(
      '/private/raw/storage/location'
    );
    expect(mediaRead).toHaveBeenCalledWith(
      expect.objectContaining({
        id: minUuid,
        profileId: minUuid,
        type: 'image',
        storagePath: '/private/raw/storage/location',
        storageStrategy: 'local_block_storage',
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ remainingBytes: expect.any(Number) }),
      })
    );
    expect(activities).toHaveLength(2);
    expect(activities[0].data.accountRoles).toEqual(['actor', 'dependent']);
    expect(activities[0].data.assetReference).toBe('*');
    expect(activities[1].data.ownedProfileId).toBeNull();
    expect(activities[1].data.assetReference).toBe('counterpart-asset');
    expect(activities[1].data.changedFieldNames).toEqual(['name']);
    expect(result.snapshotAt).toBe('2026-10-20 12:00:00.123456+00');
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes('a."id">$1::uuid') && params[0] === null
      )
    ).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes(
            '(a."profileId",a."id")>($1::varchar,$2::uuid)'
          ) && params[0] === null
      )
    ).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes('ga."id">$2::uuid') && params[1] === null
      )
    ).toBe(true);
  });

  it('queries every empty source and sends the terminal envelope only after cleanup', async () => {
    const chunks: any[] = [];
    const result = await service.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async (chunk) => {
        chunks.push(chunk);
        calls.push(`CHUNK:${chunk.source}`);
      },
    });
    expect(ASSETS_ACCOUNT_EXPORT_SOURCES).toEqual([
      'asset',
      'assetMedia',
      'guardianActivity',
    ]);
    expect(identityRead).toHaveBeenCalledTimes(1);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('FROM "asset_entity" a JOIN')
      )
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('FROM "guardian_asset_activity"')
      )
    ).toBe(true);
    expect(calls.indexOf('COMMIT')).toBeLessThan(calls.indexOf('DROP'));
    expect(calls.indexOf('DROP')).toBeLessThan(calls.indexOf('RELEASE'));
    expect(calls.indexOf('RELEASE')).toBeLessThan(calls.indexOf('CHUNK:end'));
    expect(result.source).toBe('end');
    expect(result.complete).toBe(true);
    expect(chunks.at(-1)).toBe(result);
    expect(lease).toHaveBeenCalledWith(
      { cmd: AuthCommands.ValidateAccountExportLease },
      expect.objectContaining({ accountId })
    );
  });

  it('does not emit a terminal envelope when cleanup fails and quarantines the provider', async () => {
    (runner as any).query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('CREATE TEMP TABLE')) return [];
      if (sql.startsWith('DROP TABLE'))
        throw new Error('database detail must not escape');
      return query(sql, params);
    });
    const onChunk = jest.fn(async (_chunk: any) => undefined);
    await expect(
      service.captureAccount({ grant, profileSnapshot: descriptor, onChunk })
    ).rejects.toBeInstanceOf(AssetsAccountExportOwnerError);
    expect(onChunk.mock.calls.some(([chunk]) => chunk.source === 'end')).toBe(
      false
    );
    expect(runner.release).not.toHaveBeenCalled();
    expect((runner as any).releasePostgresConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'ASSETS_ACCOUNT_EXPORT_CLEANUP_FAILED',
      })
    );
    expect(calls).toContain('EVICT');
    await expect(
      service.captureAccount({ grant, profileSnapshot: descriptor, onChunk })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
  });

  it('rejects concurrent capture while the identity snapshot is being consumed', async () => {
    let entered!: () => void;
    let unblock!: () => void;
    const enteredPromise = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (unblock = resolve));
    identityRead = jest.fn(async (_grant, _descriptor, onPage) => {
      entered();
      await gate;
      await onPage(ownedProfileIds);
    });
    service = new AssetsAccountExportOwnerService(
      { createQueryRunner: () => runner } as unknown as DataSource,
      {
        readIdentities: identityRead,
      } as unknown as AssetsAccountExportProfileSnapshotClient,
      { read: mediaRead } as unknown as AssetsAccountExportMediaReader,
      { send: lease } as unknown as ClientProxy,
      { send: profileSend } as unknown as ClientProxy
    );
    const first = service.captureAccount({
      grant,
      profileSnapshot: descriptor,
      onChunk: async () => undefined,
    });
    await enteredPromise;
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    unblock();
    await first;
  });

  it('fails closed on a stale lease between source pages', async () => {
    assetRows = [
      {
        id: minUuid,
        profileId: minUuid,
        profileIdLength: 36,
        name: 'x.png',
        nameLength: 5,
        type: 'image',
        storageStrategy: 'local_block_storage',
        storagePath: '/x',
        pathLength: 2,
        originKind: 'ordinary',
        originProfileId: null,
        originAppId: null,
        originAppIdLength: null,
        lifecycleState: 'active',
      },
    ];
    lease
      .mockReturnValueOnce(of({ valid: true }))
      .mockReturnValueOnce(of({ valid: true }))
      .mockReturnValueOnce(of({ valid: false }));
    const onChunk = jest.fn(async (_chunk: any) => undefined);
    await expect(
      service.captureAccount({ grant, profileSnapshot: descriptor, onChunk })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0].source).toBe('asset');
    expect(onChunk.mock.calls.some(([chunk]) => chunk.source === 'end')).toBe(
      false
    );
  });

  it('propagates caller abort and never completes the emitter', async () => {
    const external = new AbortController();
    const onChunk = jest.fn(async (_chunk: any) => external.abort());
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: descriptor,
        signal: external.signal,
        onChunk,
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_ABORTED' });
    expect(onChunk.mock.calls.some(([chunk]) => chunk.source === 'end')).toBe(
      false
    );
  });

  it('keeps consumer errors coded and never accepts the terminal envelope', async () => {
    const onChunk = jest.fn(async () => {
      throw new Error('private sink detail');
    });
    await expect(
      service.captureAccount({ grant, profileSnapshot: descriptor, onChunk })
    ).rejects.toMatchObject({ code: 'OWNER_STREAM_CONSUMER_FAILED' });
    expect(onChunk).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed capture grants before connecting to the database', async () => {
    await expect(
      service.captureAccount({
        grant: { ...grant, token: '' },
        profileSnapshot: descriptor,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(runner.connect).not.toHaveBeenCalled();
  });

  it('rejects malformed snapshot descriptors with a coded error before connecting', async () => {
    await expect(
      service.captureAccount({
        grant,
        profileSnapshot: { ...descriptor, sources: undefined } as any,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    expect(runner.connect).not.toHaveBeenCalled();
  });
});
