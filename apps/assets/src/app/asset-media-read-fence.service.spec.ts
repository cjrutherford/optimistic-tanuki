import { DataSource, QueryRunner } from 'typeorm';
import AssetEntity from '../entities/asset.entity';
import {
  AuthenticatedMediaReadOptions,
  VerifiedMediaSpoolHandle,
} from '@optimistic-tanuki/storage';
import { AssetMediaReadFenceService } from './asset-media-read-fence.service';

const asset = () =>
  ({
    id: 'asset-1',
    profileId: '123e4567-e89b-42d3-a456-426614174000',
    storagePath: 'private/a',
    storageStrategy: 'local-block-storage',
    lifecycleState: 'active',
  } as unknown as AssetEntity);

describe('AssetMediaReadFenceService', () => {
  let service: AssetMediaReadFenceService;
  let runner: any;
  let dataSource: DataSource;
  let activeRows: any[];
  let fenceRows: any[];
  let calls: string[];

  beforeEach(() => {
    calls = [];
    activeRows = [
      {
        id: 'asset-1',
        profileId: asset().profileId,
        storagePath: 'private/a',
        storageStrategy: 'local-block-storage',
        lifecycleState: 'active',
      },
    ];
    fenceRows = [];
    runner = {
      isTransactionActive: false,
      connect: jest.fn(async () => {
        calls.push('connect');
      }),
      startTransaction: jest.fn(async () => {
        calls.push('begin');
        runner.isTransactionActive = true;
      }),
      query: jest.fn(async (sql: string) => {
        calls.push(sql);
        if (sql.includes('FROM "asset_entity"')) return activeRows;
        if (sql.includes('FROM account_deletion_write_fence')) return fenceRows;
        return [];
      }),
      commitTransaction: jest.fn(async () => {
        calls.push('commit');
        runner.isTransactionActive = false;
      }),
      rollbackTransaction: jest.fn(async () => {
        calls.push('rollback');
        runner.isTransactionActive = false;
      }),
      release: jest.fn(async () => {
        calls.push('release');
      }),
    } as unknown as QueryRunner;
    dataSource = { createQueryRunner: () => runner } as unknown as DataSource;
    service = new AssetMediaReadFenceService(dataSource);
  });

  it('holds the shared transaction until the authenticated spool is cleaned', async () => {
    const underlying = {
      path: '/private/spool',
      size: 10,
      createReadStream: jest.fn(),
      cleanup: jest.fn(async () => {
        calls.push('spool-cleanup');
      }),
    } as unknown as VerifiedMediaSpoolHandle;
    let opened = false;
    const handle = await service.open(
      asset(),
      { maxPlaintextBytes: 100 } as AuthenticatedMediaReadOptions,
      async () => {
        opened = true;
        expect(runner.commitTransaction).not.toHaveBeenCalled();
        return underlying;
      }
    );
    expect(opened).toBe(true);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    await handle.cleanup();
    expect(calls.indexOf('spool-cleanup')).toBeLessThan(
      calls.indexOf('commit')
    );
    expect(calls.indexOf('commit')).toBeLessThan(calls.indexOf('release'));
    await handle.cleanup();
    expect(underlying.cleanup).toHaveBeenCalledTimes(1);
  });

  it('rejects an installed deletion fence before opening storage', async () => {
    fenceRows = [{ operationId: 'op' }];
    const open = jest.fn();
    await expect(
      service.open(asset(), { maxPlaintextBytes: 100 }, open)
    ).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('rejects changed or revoked fresh metadata before opening storage', async () => {
    activeRows = [
      {
        id: 'asset-1',
        profileId: asset().profileId,
        storagePath: 'other',
        storageStrategy: 'local-block-storage',
        lifecycleState: 'active',
      },
    ];
    const open = jest.fn();
    await expect(
      service.open(asset(), { maxPlaintextBytes: 100 }, open)
    ).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });

  it('retains the read lease when anonymous spool cleanup fails', async () => {
    const underlying = {
      path: '/private/spool',
      size: 10,
      createReadStream: jest.fn(),
      cleanup: jest.fn(async () => {
        calls.push('spool-cleanup-failed');
        throw new Error('close failed');
      }),
    } as unknown as VerifiedMediaSpoolHandle;
    const handle = await service.open(
      asset(),
      { maxPlaintextBytes: 100 },
      async () => underlying
    );
    await expect(handle.cleanup()).rejects.toThrow('close failed');
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).not.toHaveBeenCalled();
  });
});
