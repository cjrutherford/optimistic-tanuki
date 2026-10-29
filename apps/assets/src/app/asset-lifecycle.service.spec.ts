import { Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { GuardianAssetActivity } from '../entities/guardian-asset-activity.entity';

describe('asset lifecycle cleanup', () => {
  it('backs off a failed tombstone and continues to clean later rows', async () => {
    const rows: any[] = [
      {
        id: 'bad',
        lifecycleState: 'pending-upload',
        lifecycleLeaseUntil: new Date(Date.now() - 60_000),
        storagePath: 'assets/bad/file',
      },
      {
        id: 'good',
        lifecycleState: 'pending-delete',
        storagePath: 'assets/good/file',
      },
    ];
    const adapter = {
      remove: jest.fn(async (asset: { id: string }) => {
        if (asset.id === 'bad')
          throw Object.assign(new Error('storage unavailable'), {
            code: 'EIO',
          });
      }),
    };
    const repo: any = {
      createQueryBuilder: jest.fn(() => {
        const query: any = {
          setLock: () => query,
          setOnLocked: () => query,
          where: () => query,
          orderBy: () => query,
          getOne: async () =>
            rows.find(
              (row) =>
                (row.lifecycleState === 'pending-delete' &&
                  (!row.lifecycleRetryAfter ||
                    row.lifecycleRetryAfter <= new Date())) ||
                (row.lifecycleState === 'pending-upload' &&
                  row.lifecycleLeaseUntil < new Date())
            ) ?? null,
        };
        return query;
      }),
      delete: jest.fn(async ({ id }: { id: string }) => {
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0) rows.splice(index, 1);
        return { affected: index >= 0 ? 1 : 0 };
      }),
      save: jest.fn(async (row: object) => row),
      update: jest.fn(async ({ id }: { id: string }, patch: object) => {
        Object.assign(
          rows.find((row) => row.id === id),
          patch
        );
        return { affected: 1 };
      }),
      manager: undefined,
    };
    const manager: any = {
      getRepository: (entity: unknown) =>
        entity === GuardianAssetActivity ? { delete: jest.fn() } : repo,
      transaction: async (work: (value: unknown) => unknown) => {
        const snapshot = rows.map((row) => ({ ...row }));
        try {
          return await work(manager);
        } catch (error) {
          rows.splice(0, rows.length, ...snapshot);
          throw error;
        }
      },
    };
    repo.manager = manager;
    const service = new AppService(
      new Logger(),
      repo,
      adapter as any,
      {} as any,
      {} as any
    );

    await expect(service.cleanupPendingAssets()).resolves.toBe(1);
    expect(adapter.remove.mock.calls.map(([asset]) => asset.id)).toEqual([
      'bad',
      'good',
    ]);
    expect(rows.map((row) => row.id)).toEqual(['bad']);
    expect(rows[0].lifecycleState).toBe('pending-delete');
    expect(rows[0].lifecycleRetryAfter.getTime()).toBeGreaterThan(Date.now());
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'bad', lifecycleState: 'pending-upload' },
      expect.objectContaining({
        lifecycleState: 'pending-delete',
        lifecycleRetryAfter: expect.any(Date),
      })
    );
  });

  it('keeps an expired upload locked from cleanup and refuses late activation', async () => {
    const row: any = {
      id: '11111111-1111-4111-8111-111111111111',
      lifecycleState: 'pending-upload',
      lifecycleLeaseUntil: new Date(Date.now() + 15 * 60_000),
      lifecycleRetryAfter: null,
    };
    const rows = [row];
    let rowLocked = false;
    let uploadLockObserved = false;
    let cleanupLockMode: string | undefined;
    let cleanupOnLocked: string | undefined;
    let beginStorage!: () => void;
    let finishStorage!: (asset: object) => void;
    const storageStarted = new Promise<void>((resolve) => {
      beginStorage = resolve;
    });
    const adapter: any = {
      reservationPath: jest.fn(() => `assets/${row.id}/photo.png`),
      create: jest.fn(() => {
        beginStorage();
        return new Promise((resolve) => {
          finishStorage = resolve;
        });
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const repo: any = {
      create: jest.fn((data) => Object.assign(row, data)),
      save: jest.fn(async (asset) => asset),
      findOne: jest.fn(async (options: { lock?: { mode?: string } }) => {
        uploadLockObserved = options?.lock?.mode === 'pessimistic_write';
        rowLocked = uploadLockObserved;
        return row;
      }),
      delete: jest.fn(async ({ id }: { id: string }) => {
        const index = rows.findIndex((asset) => asset.id === id);
        if (index >= 0) rows.splice(index, 1);
        return { affected: index >= 0 ? 1 : 0 };
      }),
      createQueryBuilder: jest.fn(() => {
        const query: any = {
          setLock: (mode: string) => {
            cleanupLockMode = mode;
            return query;
          },
          setOnLocked: (mode: string) => {
            cleanupOnLocked = mode;
            return query;
          },
          where: () => query,
          orderBy: () => query,
          getOne: async () =>
            rowLocked &&
            cleanupLockMode === 'pessimistic_write' &&
            cleanupOnLocked === 'skip_locked'
              ? null
              : rows.find(
                  (asset) =>
                    asset.lifecycleState === 'pending-upload' &&
                    asset.lifecycleLeaseUntil <= new Date()
                ) ?? null,
        };
        return query;
      }),
      manager: undefined,
    };
    const manager: any = {
      getRepository: (entity: unknown) =>
        entity === GuardianAssetActivity ? { save: jest.fn() } : repo,
      transaction: async (work: (value: unknown) => unknown) => {
        const nested = rowLocked;
        const snapshot = rows.map((asset) => ({ ...asset }));
        try {
          return await work(manager);
        } catch (error) {
          if (!nested) rows.splice(0, rows.length, ...snapshot);
          throw error;
        } finally {
          if (!nested) rowLocked = false;
        }
      },
    };
    repo.manager = manager;
    const authorization = {
      assertAccess: jest.fn().mockResolvedValue({
        id: 'dependent-profile',
        userId: 'dependent-user',
      }),
    };
    const service = new AppService(
      new Logger(),
      repo,
      adapter,
      {
        getMaxSizeBytes: () => 1000,
        validateFile: () => ({ isValid: true }),
      } as any,
      { scanFile: async () => ({ isClean: true, scanner: 'test' }) } as any,
      authorization as any
    );

    const upload = service.createGuardianAsset({
      actorUserId: 'guardian-user',
      targetProfileId: 'dependent-profile',
      appId: 'client-interface',
      asset: {
        name: 'photo.png',
        type: 'image',
        profileId: 'dependent-profile',
        content: Buffer.from('photo'),
      } as any,
    });
    await storageStarted;
    expect(uploadLockObserved).toBe(true);
    row.lifecycleLeaseUntil = new Date(0);
    await expect(service.cleanupPendingAssets()).resolves.toBe(0);
    expect(cleanupLockMode).toBe('pessimistic_write');
    expect(cleanupOnLocked).toBe('skip_locked');
    expect(adapter.remove).not.toHaveBeenCalled();

    finishStorage({
      id: row.id,
      name: 'photo.png',
      storagePath: adapter.reservationPath(),
      type: 'image',
      profileId: 'dependent-profile',
    });
    await expect(upload).rejects.toThrow(
      'Guardian upload reservation expired during storage write'
    );
    expect(repo.save).toHaveBeenCalledTimes(1); // reservation only; no active transition
    expect(adapter.remove).toHaveBeenCalledTimes(1); // late bytes are compensated
    expect(repo.delete).toHaveBeenCalledWith({
      id: row.id,
      lifecycleState: 'pending-upload',
    });
    expect(rows).toHaveLength(0);
  });
});
