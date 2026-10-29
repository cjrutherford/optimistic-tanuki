import {
  AccountExportArtifactStoreService,
  ArtifactDescriptor,
} from '@optimistic-tanuki/storage';
import { AccountExportDownloadService } from './account-export-download.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';
import { AccountExportArtifactRetentionService } from './account-export-artifact-retention.service';

const ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const descriptor: ArtifactDescriptor = {
  artifactId: '33333333-3333-4333-8333-333333333333',
  jobId: ID,
  accountId: ACCOUNT,
  appId: 'client-interface',
  attempt: 1,
  expiresAt: '2026-01-01T00:00:00.000Z',
  sizeBytes: 4,
  sha256: 'a'.repeat(64),
  frameCount: 1,
  framingVersion: 1,
};
const row = (overrides: Partial<AccountExportJobEntity> = {}) =>
  Object.assign(new AccountExportJobEntity(), {
    id: ID,
    accountId: ACCOUNT,
    appId: 'client-interface',
    kind: 'export',
    state: 'complete',
    attempt: 1,
    leaseOwner: null,
    leaseExpiresAt: null,
    coverageSummary: {
      privateArtifact: descriptor,
      artifactAvailable: true,
      artifactState: 'verified',
      participantCount: 7,
    },
    ...overrides,
  });

function fixture(initial: AccountExportJobEntity[]) {
  const rows = new Map(initial.map((r) => [r.id, r]));
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => [...rows.values()]),
  };
  const manager: any = {
    getRepository: () => txRepo,
    transaction: async (callback: (m: any) => unknown) => callback(manager),
    query: jest.fn(async (sql: string, values: any[]) => {
      if (sql.startsWith('WITH history_due')) return [[], 0];
      if (sql.includes('AS "historyRemaining"'))
        return [{ historyRemaining: '0' }];
      if (sql.startsWith('SELECT')) {
        const r = rows.get(values[0]);
        return [
          {
            live:
              r?.state === 'running' &&
              !!r?.leaseExpiresAt &&
              r.leaseExpiresAt.getTime() > Date.now(),
          },
        ];
      }
      const current = rows.get(values[0]);
      if (current)
        Object.assign(current, {
          state: values[1],
          leaseOwner: values[2],
          leaseExpiresAt: values[3],
          lastErrorCode: values[4],
          coverageSummary: JSON.parse(values[5]),
        });
      return [];
    }),
  };
  const locked: any = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => rows.get(ID)),
  };
  const repo: any = {
    manager,
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(async () => rows.get(ID)),
    save: jest.fn(async (value) => {
      rows.set(value.id, value);
      return value;
    }),
  };
  const txRepo: any = {
    createQueryBuilder: jest.fn(() => locked),
    save: repo.save,
    findOne: repo.findOne,
  };
  const store = {
    purgeOwnedArtifact: jest.fn(async (_d, authorized) => {
      if (!(await authorized())) throw Error('not authorized');
    }),
    sweepExpiredTemps: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<
      AccountExportArtifactStoreService,
      'purgeOwnedArtifact' | 'sweepExpiredTemps'
    >
  >;
  const downloads = {
    invalidateJob: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AccountExportDownloadService>;
  const service = new AccountExportArtifactRetentionService(
    repo,
    store as never,
    downloads
  );
  return { service, rows, qb, locked, store, downloads, manager };
}

describe('AccountExportArtifactRetentionService', () => {
  it('prunes only old terminal history after artifact custody is clear', async () => {
    const f = fixture([]);
    f.manager.query.mockImplementation(async (sql: string) =>
      sql.includes('AS "historyRemaining"')
        ? [{ historyRemaining: '0' }]
        : [[{ id: ID }], 1]
    );
    await expect(f.service.pruneHistory()).resolves.toEqual({
      removed: 1,
      remaining: 0,
    });
    const sql = f.manager.query.mock.calls[0][0];
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('privateArtifact');
    expect(sql).toContain('cleanup-pending');
    expect(sql).toContain("interval '90 days'");
    expect(f.store.purgeOwnedArtifact).not.toHaveBeenCalled();
  });

  it('removes an expired artifact, preserving unrelated coverage only after purge readback', async () => {
    const f = fixture([row()]);
    await expect(f.service.sweep()).resolves.toEqual({ removed: 1, failed: 0 });
    expect(f.downloads.invalidateJob).toHaveBeenCalledWith(ID);
    expect(f.store.purgeOwnedArtifact).toHaveBeenCalledWith(
      descriptor,
      expect.any(Function)
    );
    expect(f.rows.get(ID)?.coverageSummary).toEqual({
      artifactAvailable: false,
      artifactState: 'expired',
      participantCount: 7,
    });
    expect(f.store.sweepExpiredTemps).toHaveBeenCalledWith(expect.any(Number));
  });

  it('retains descriptor and marks cleanup pending when storage removal fails, then retries', async () => {
    const f = fixture([row()]);
    f.store.purgeOwnedArtifact.mockRejectedValueOnce(
      new Error('storage unavailable')
    );
    await expect(f.service.sweep()).resolves.toEqual({ removed: 0, failed: 1 });
    expect(f.rows.get(ID)?.coverageSummary).toMatchObject({
      privateArtifact: descriptor,
      artifactState: 'cleanup-pending',
      artifactAvailable: false,
    });
    await expect(f.service.sweep()).resolves.toEqual({ removed: 1, failed: 0 });
  });

  it('fences a running account job before purge and preserves foreign-app rows', async () => {
    const running = row({
      state: 'running',
      leaseOwner: 'worker',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const f = fixture([running]);
    await expect(f.service.purgeAccount(ACCOUNT)).resolves.toEqual({
      removed: 1,
      failed: 0,
    });
    expect(f.rows.get(ID)?.state).toBe('failed');
    expect(f.rows.get(ID)?.leaseOwner).toBeNull();
  });

  it('sets the deletion operation inside each artifact purge transaction', async () => {
    const f = fixture([row()]);
    const operationId = '55555555-5555-4555-8555-555555555555';
    await f.service.purgeAccount(ACCOUNT, operationId);
    expect(f.manager.query).toHaveBeenCalledWith(
      "SELECT set_config('ot.deletion_operation', $1, true)",
      [operationId]
    );
  });

  it('does not expire a live running lease or an unexpired artifact', async () => {
    const f = fixture([
      row({
        state: 'running',
        leaseOwner: 'live',
        leaseExpiresAt: new Date(Date.now() + 60000),
      }),
    ]);
    expect(await f.service.sweep()).toEqual({ removed: 0, failed: 0 });
    expect(f.store.purgeOwnedArtifact).not.toHaveBeenCalled();
    const future = { ...descriptor, expiresAt: '2099-01-01T00:00:00.000Z' };
    f.rows.set(ID, row({ coverageSummary: { privateArtifact: future } }));
    expect(await f.service.sweep()).toEqual({ removed: 0, failed: 0 });
    expect(f.store.purgeOwnedArtifact).not.toHaveBeenCalled();
  });

  it('preserves a foreign account or product even if a candidate query returns it', async () => {
    const f = fixture([
      row({ accountId: '44444444-4444-4444-8444-444444444444' }),
    ]);
    expect(await f.service.purgeAccount(ACCOUNT)).toEqual({
      removed: 0,
      failed: 0,
    });
    f.rows.set(ID, row({ appId: 'foreign-product' }));
    expect(await f.service.sweep()).toEqual({ removed: 0, failed: 0 });
    expect(f.store.purgeOwnedArtifact).not.toHaveBeenCalled();
    expect(f.downloads.invalidateJob).not.toHaveBeenCalled();
  });
});
