import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
} from '@optimistic-tanuki/storage';
import { AccountExportOwnerRecord } from '@optimistic-tanuki/models';
import { of, Subject } from 'rxjs';
import {
  PROFILE_ACCOUNT_EXPORT_SOURCES,
  ProfileAccountExportOwnerService,
} from './account-export-owner.service';
import {
  ProfileAccountExportSnapshotError,
  ProfileAccountExportSnapshotService,
} from './account-export-snapshot.service';

jest.mock('uuid', () => ({
  v4: () => require('node:crypto').randomUUID(),
}));

const ACCOUNT_ID = 'd816be66-4fb6-4ed6-a91d-cc058bd5c816';
const OTHER_ACCOUNT = '9c9e2b0a-7a74-4cda-a0cf-13f8fc89922a';
const APP_ID = 'client-interface';
const JOB_ID = 'f1384460-a162-49d4-89a0-5f7a07d8bd06';
const LEASE_OWNER = 'd59f45d5-d63a-4b29-b3b0-5d8377fe77a1';
const IDS = [
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
];
const grant = {
  accountId: ACCOUNT_ID,
  appId: APP_ID,
  token: 'session-secret-for-test',
  jobId: JOB_ID,
  attempt: 2,
  leaseOwner: LEASE_OWNER,
};

function sourceFactory(source: string, records: AccountExportOwnerRecord[]) {
  return async function* () {
    if (source === 'profileIdentity' || source === 'profile') {
      yield* records;
    }
  };
}

function makeOwner(): ProfileAccountExportOwnerService {
  const owner = {
    captureAccount: async ({ onChunk, signal }: any) => {
      const emitter = new AccountExportOwnerEmitter(
        {
          participantId: 'profile',
          accountId: ACCOUNT_ID,
          captureId: 'capture-test-1',
          snapshotAt: '2026-10-20T12:00:00.000Z',
          sources: PROFILE_ACCOUNT_EXPORT_SOURCES,
          signal,
        },
        onChunk
      );
      const identityRecords = IDS.map((id) => ({
        source: 'profileIdentity' as const,
        data: { id, userId: ACCOUNT_ID },
      }));
      const profileRecords = IDS.map((id) => ({
        source: 'profile' as const,
        data: { id, userId: ACCOUNT_ID },
      }));
      const streams: Record<string, () => AsyncGenerator<any>> = {};
      for (const source of PROFILE_ACCOUNT_EXPORT_SOURCES) {
        streams[source] = sourceFactory(
          source,
          source === 'profileIdentity' ? identityRecords : profileRecords
        );
      }
      await emitter.emitSources(streams as any);
      return emitter.complete(
        Object.fromEntries(
          PROFILE_ACCOUNT_EXPORT_SOURCES.map((source) => [
            source,
            'unit-test-source',
          ])
        )
      );
    },
  };
  return owner as unknown as ProfileAccountExportOwnerService;
}

describe('ProfileAccountExportSnapshotService', () => {
  let authValid: boolean;
  let authClient: { send: jest.Mock };
  let service: ProfileAccountExportSnapshotService;

  beforeEach(() => {
    authValid = true;
    authClient = {
      send: jest.fn(() => of({ valid: authValid })),
    };
    service = new ProfileAccountExportSnapshotService(
      makeOwner(),
      new AccountExportOwnerSpoolService(),
      authClient as unknown as ClientProxy
    );
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('stages actual verified JSONL, pages identities from that capture, and reads bounded bytes', async () => {
    const descriptor = await service.open(grant);
    expect(descriptor).toMatchObject({
      participantId: 'profile',
      accountId: ACCOUNT_ID,
      captureId: 'capture-test-1',
      identityCount: IDS.length,
    });
    expect(JSON.stringify(descriptor)).not.toContain(grant.token);
    expect(JSON.stringify(descriptor)).not.toContain(grant.leaseOwner);
    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ValidateAccountExportLease },
      grant
    );

    const first = await service.readIdentities({
      ...grant,
      handleId: descriptor.handleId,
      offset: 0,
      limit: 2,
    });
    expect(first.profileIds).toEqual(IDS.slice(0, 2));
    expect(first.nextOffset).toBe(2);
    const last = await service.readIdentities({
      ...grant,
      token: 'rotated-valid-session-token',
      handleId: descriptor.handleId,
      offset: 2,
      limit: 100,
    });
    expect(last.profileIds).toEqual(IDS.slice(2));
    expect(last.nextOffset).toBeNull();

    const bytes = await service.read({
      ...grant,
      handleId: descriptor.handleId,
      offset: 0,
      length: 64 * 1024,
    });
    const jsonl = Buffer.from(bytes.bytesBase64, 'base64').toString('utf8');
    expect(jsonl).toContain('profileIdentity');
    expect(jsonl).toContain(IDS[0]);
    expect(bytes.eof).toBe(true);

    const eof = await service.read({
      ...grant,
      handleId: descriptor.handleId,
      offset: descriptor.sizeBytes,
      length: 1,
    });
    expect(eof.bytesBase64).toBe('');
    expect(eof.eof).toBe(true);
  });

  it('rejects foreign scope without releasing the bound snapshot, then allows exact stale-lease cleanup', async () => {
    const descriptor = await service.open(grant);
    await expect(
      service.release({
        ...grant,
        accountId: OTHER_ACCOUNT,
        handleId: descriptor.handleId,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
    const stillReadable = await service.readIdentities({
      ...grant,
      handleId: descriptor.handleId,
      offset: 0,
      limit: 1,
    });
    expect(stillReadable.profileIds).toEqual([IDS[0]]);

    authValid = false;
    await expect(
      service.read({
        ...grant,
        handleId: descriptor.handleId,
        offset: 0,
        length: 10,
      })
    ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    await expect(
      service.release({ ...grant, handleId: descriptor.handleId })
    ).resolves.toEqual({ handleId: descriptor.handleId, released: true });
    await expect(
      service.read({
        ...grant,
        handleId: descriptor.handleId,
        offset: 0,
        length: 10,
      })
    ).rejects.toBeInstanceOf(ProfileAccountExportSnapshotError);
  });

  it('rejects invalid grants and bounded read or identity ranges', async () => {
    await expect(service.open({ ...grant, attempt: 0 })).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    const descriptor = await service.open(grant);
    await expect(
      service.read({
        ...grant,
        handleId: descriptor.handleId,
        offset: -1,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
    await expect(
      service.readIdentities({
        ...grant,
        handleId: descriptor.handleId,
        offset: 0,
        limit: 101,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_INVALID_RANGE' });
  });

  it('accepts only the exact lease-validation success shape', async () => {
    authClient.send.mockReturnValueOnce(
      of({ valid: true, accountId: ACCOUNT_ID })
    );
    await expect(service.open(grant)).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
  });

  it('does not open after shutdown while initial lease validation is pending', async () => {
    const leaseResponse = new Subject<{ valid: boolean }>();
    authClient.send.mockReturnValueOnce(leaseResponse);
    const opening = service.open(grant);
    await service.onModuleDestroy();
    leaseResponse.next({ valid: true });
    leaseResponse.complete();
    await expect(opening).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CLOSED',
    });
  });

  it('revalidates the lease for every owner chunk and publishes no handle after revocation', async () => {
    let validationCount = 0;
    authClient.send.mockImplementation(() =>
      of({ valid: ++validationCount < 3 })
    );
    await expect(service.open(grant)).rejects.toMatchObject({
      code: 'OWNER_AUTHORIZATION_FAILED',
    });
    expect(validationCount).toBeGreaterThan(2);
  });

  it('enforces the two-handle registry bound and cleans staged descriptors on shutdown', async () => {
    const first = await service.open(grant);
    const second = await service.open({ ...grant, attempt: 3 });
    await expect(service.open({ ...grant, attempt: 4 })).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CAPACITY',
    });

    await service.onModuleDestroy();
    await expect(
      service.read({ ...grant, handleId: first.handleId, offset: 0, length: 1 })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
    await expect(
      service.read({
        ...grant,
        attempt: 3,
        handleId: second.handleId,
        offset: 0,
        length: 1,
      })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
    await expect(
      service.release({ ...grant, handleId: first.handleId })
    ).resolves.toEqual({ handleId: first.handleId, released: true });
  });

  it('keeps cleanup failures retired and charged until exact-scope cleanup succeeds', async () => {
    const first = await service.open(grant);
    const second = await service.open({ ...grant, attempt: 3 });
    const registry = service as any;
    const entry = registry.entries.get(first.handleId);
    const cleanup = jest
      .spyOn(entry.spool, 'cleanup')
      .mockRejectedValue(new Error('injected close failure'));

    await expect(
      service.release({ ...grant, handleId: first.handleId })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_CLEANUP_FAILED' });
    expect(entry.retired).toBe(true);
    expect(registry.entries.has(first.handleId)).toBe(true);
    expect(registry.reservedBytes).toBeGreaterThanOrEqual(
      entry.reservedBytes + registry.entries.get(second.handleId).reservedBytes
    );
    await expect(service.open({ ...grant, attempt: 4 })).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CAPACITY',
    });
    await expect(
      service.read({ ...grant, handleId: first.handleId, offset: 0, length: 1 })
    ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_CLEANUP_FAILED' });

    cleanup.mockRestore();
    await expect(
      service.release({ ...grant, handleId: first.handleId })
    ).resolves.toEqual({ handleId: first.handleId, released: true });
  });

  it('retains the full reservation when post-capture validation cleanup fails', async () => {
    const owner = makeOwner();
    const spool = new AccountExportOwnerSpoolService();
    service = new ProfileAccountExportSnapshotService(
      owner,
      spool,
      authClient as unknown as ClientProxy
    );
    const ownerCapture = owner.captureAccount.bind(owner);
    jest.spyOn(owner, 'captureAccount').mockImplementation(async (options) => {
      const terminal = await ownerCapture(options);
      authValid = false;
      return terminal;
    });
    const capture = spool.capture.bind(spool);
    let cleanupSpy: jest.SpyInstance | undefined;
    jest.spyOn(spool, 'capture').mockImplementation(async (...args: any[]) => {
      const handle = await (capture as any)(...args);
      cleanupSpy = jest
        .spyOn(handle, 'cleanup')
        .mockRejectedValue(new Error('injected pending cleanup failure'));
      return handle;
    });

    await expect(service.open(grant)).rejects.toMatchObject({
      code: 'OWNER_SNAPSHOT_CLEANUP_FAILED',
    });
    const registry = service as any;
    expect(registry.entries.size).toBe(1);
    expect(registry.reservedBytes).toBe(256 * 1024 * 1024);
    expect([...registry.entries.values()][0].retired).toBe(true);

    cleanupSpy?.mockRestore();
    await service.onModuleDestroy();
    expect(registry.entries.size).toBe(0);
    expect(registry.reservedBytes).toBe(0);
  });
  it('purges all actual account spools, denies old reads and prevents later account opens', async () => {
    const one = await service.open(grant);
    await service.open(grant);
    expect(await service.purgeAccount(ACCOUNT_ID)).toEqual({ remaining: 0 });
    await expect(
      service.read({ ...grant, handleId: one.handleId, offset: 0, length: 1 })
    ).rejects.toBeDefined();
    await expect(service.open(grant)).rejects.toMatchObject({
      code: 'OWNER_ACCOUNT_PURGED',
    });
    expect(await service.purgeAccount(ACCOUNT_ID)).toEqual({ remaining: 0 });
  });
});
