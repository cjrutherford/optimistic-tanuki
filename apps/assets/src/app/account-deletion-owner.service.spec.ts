import { randomUUID } from 'node:crypto';
import { AssetsAccountDeletionOwnerService } from './account-deletion-owner.service';
import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';
const account = randomUUID(),
  profile = randomUUID(),
  other = randomUUID(),
  operation = randomUUID(),
  id = randomUUID();
const grant = {
  contractVersion: 1,
  operationId: operation,
  accountId: account,
  appId: 'client-interface',
  owner: 'assets',
  action: 'erase',
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  signature: 'a'.repeat(64),
};
const owned = () => ({
  id,
  name: 'owned image.bin',
  profileId: profile,
  type: AssetType.IMAGE,
  storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
  storagePath: `assets/${id}/owned_image.bin`,
  originKind: 'ordinary',
  originProfileId: null,
  originAppId: null,
  lifecycleState: 'pending-delete',
  lifecycleLeaseUntil: null,
  lifecycleRetryAfter: null,
});
describe('Assets deletion owner', () => {
  let state: any[],
    calls: Array<{ sql: string; args: unknown[] }>,
    query: any,
    runner: any,
    authority: any,
    adapter: any,
    audit: any,
    service: AssetsAccountDeletionOwnerService;
  beforeEach(() => {
    state = [owned()];
    calls = [];
    query = jest.fn(async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args });
      if (
        sql.includes('SELECT "operationId" FROM account_deletion_write_fence')
      )
        return [{ operationId: operation }];
      if (sql.includes('count(*)') && sql.includes('"asset_entity"'))
        return [
          {
            count: state.filter(
              (r) => r.profileId === profile || r.originProfileId === profile
            ).length,
          },
        ];
      if (sql.includes('guardian_asset_activity')) return [{ count: 0 }];
      if (sql.startsWith('SELECT * FROM "asset_entity"'))
        return state.filter((r) => r.id === args[0]);
      if (sql.startsWith('SELECT "id" FROM "asset_entity"'))
        return state
          .filter(
            (r) =>
              r.profileId === profile &&
              r.lifecycleState === 'pending-delete' &&
              (!args[1] || r.id > String(args[1]))
          )
          .map((r) => ({ id: r.id }));
      if (sql.startsWith('SELECT "id", "profileId"'))
        return state.filter(
          (r) => r.profileId === profile || r.originProfileId === profile
        );
      if (sql.startsWith('DELETE FROM "asset_entity"')) {
        state = state.filter((r) => r.id !== args[0]);
        return [];
      }
      if (sql.startsWith('UPDATE "asset_entity"'))
        for (const r of state.filter(
          (r) =>
            r.id === args[0] ||
            (Array.isArray(args[0]) && args[0].includes(r.id))
        )) {
          r.lifecycleState = 'pending-delete';
          r.lifecycleLeaseUntil = null;
        }
      return [];
    });
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      query,
      manager: { query },
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
    };
    authority = {
      validate: jest.fn(async () => ({
        accountId: account,
        scope: { currentProfileIds: [profile], legacyProfileIds: [] },
      })),
    };
    adapter = {
      purgeOwnedAsset: jest.fn(async () => ({ verifiedAbsent: true })),
    };
    audit = {
      eraseParticipation: jest.fn(async () => ({
        allDeclaredSourcesVerified: true,
      })),
    };
    service = new AssetsAccountDeletionOwnerService(
      { createQueryRunner: () => runner } as never,
      authority,
      adapter,
      audit,
      { assertDeletionReady: jest.fn().mockResolvedValue(undefined) } as never
    );
  });
  it('rejects wrong owner, action and absent authority scope before local work', async () => {
    await expect(
      service.execute({ ...grant, owner: 'profile' }, 'erase')
    ).rejects.toThrow('GRANT_INVALID');
    await expect(service.execute(grant, 'readback')).rejects.toThrow(
      'GRANT_INVALID'
    );
    authority.validate.mockResolvedValue({ accountId: account, scope: null });
    await expect(service.execute(grant, 'erase')).rejects.toThrow(
      'SCOPE_REQUIRED'
    );
    expect(calls).toHaveLength(0);
  });
  it('leaves a conflicting origin untouched rather than deleting a foreign asset', async () => {
    state = [
      {
        ...owned(),
        originKind: 'guardian-staged',
        originProfileId: randomUUID(),
      },
    ];
    await expect(service.execute(grant, 'erase')).rejects.toThrow(
      'ASSET_ORIGIN_CONFLICT'
    );
    expect(adapter.purgeOwnedAsset).not.toHaveBeenCalled();
  });
  it('preserves metadata and path on store failure, then removes only the target after verified retry', async () => {
    const foreign = { ...owned(), id: randomUUID(), profileId: other };
    state.push(foreign);
    adapter.purgeOwnedAsset.mockRejectedValueOnce(new Error('I/O unavailable'));
    await expect(service.execute(grant, 'erase')).rejects.toThrow(
      'STORAGE_PURGE_FAILED'
    );
    expect(state.find((r) => r.id === id)).toMatchObject({
      lifecycleState: 'pending-delete',
      storagePath: owned().storagePath,
    });
    expect(state).toContain(foreign);
    await expect(service.execute(grant, 'erase')).resolves.toMatchObject({
      fenced: true,
    });
    expect(state).toEqual([foreign]);
    expect(adapter.purgeOwnedAsset).toHaveBeenCalledTimes(2);
    expect(calls.some((c) => c.sql.includes('FROM "profile"'))).toBe(false);
  });
  it('reports actual fenced metadata without purging bytes during fencing', async () => {
    state[0].lifecycleState = 'active';
    expect(
      await service.execute({ ...grant, action: 'fence' }, 'fence')
    ).toMatchObject({ fenced: true, profileCount: 1 });
    expect(adapter.purgeOwnedAsset).not.toHaveBeenCalled();
  });
  it('rejects unverified storage absence and incomplete readback', async () => {
    adapter.purgeOwnedAsset.mockResolvedValue({ verifiedAbsent: false });
    await expect(service.execute(grant, 'erase')).rejects.toThrow(
      'STORAGE_ABSENCE_UNVERIFIED'
    );
    expect(state).toHaveLength(1);
    await expect(
      service.execute({ ...grant, action: 'readback' }, 'readback')
    ).rejects.toThrow('READBACK_INCOMPLETE');
  });
  it('does not accept a missing count as empty completion', async () => {
    state = [];
    query.mockResolvedValue([]);
    await expect(
      service.execute({ ...grant, action: 'readback' }, 'readback')
    ).rejects.toThrow('READBACK_INVALID');
  });
});
