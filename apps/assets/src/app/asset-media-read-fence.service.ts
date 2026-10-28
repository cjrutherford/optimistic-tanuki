import { Inject, Injectable } from '@nestjs/common';
import {
  AuthenticatedMediaReadOptions,
  DeletionIdentity,
  VerifiedMediaSpoolHandle,
  VerifiedMediaSpoolCleanupError,
  deletionIdentityKey,
} from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import AssetEntity from '../entities/asset.entity';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Separate read-drain namespace: ordinary asset writes must not wait for media clients. */
export function assetMediaReadLockKey(profileId: string): string {
  const kind: DeletionIdentity['kind'] = UUID.test(profileId)
    ? 'profile'
    : 'legacy-profile';
  return `ot-asset-media-read-v1:${deletionIdentityKey(kind, profileId)}`;
}

@Injectable()
export class AssetMediaReadFenceService {
  constructor(
    @Inject('ASSETS_CONNECTION') private readonly dataSource: DataSource
  ) {}

  async open(
    asset: AssetEntity,
    options: AuthenticatedMediaReadOptions,
    open: () => Promise<VerifiedMediaSpoolHandle>
  ): Promise<VerifiedMediaSpoolHandle> {
    if (options.signal?.aborted) throw new Error('ASSET_MEDIA_READ_ABORTED');
    const snapshot = {
      id: asset.id,
      profileId: asset.profileId,
      storagePath: asset.storagePath,
      storageStrategy: asset.storageStrategy,
    };
    if (
      !snapshot.id ||
      typeof snapshot.profileId !== 'string' ||
      !snapshot.profileId.trim()
    )
      throw new Error('ASSET_MEDIA_IDENTITY_INVALID');
    const kind: DeletionIdentity['kind'] = UUID.test(snapshot.profileId)
      ? 'profile'
      : 'legacy-profile';
    const key = deletionIdentityKey(kind, snapshot.profileId);
    const runner = this.dataSource.createQueryRunner();
    let handle: VerifiedMediaSpoolHandle | undefined;
    let settled = false;
    let cleanupPromise: Promise<void> | undefined;
    try {
      await runner.connect();
      await runner.startTransaction();
      await runner.query(
        'SELECT pg_advisory_xact_lock_shared(hashtextextended($1, 0))',
        [assetMediaReadLockKey(snapshot.profileId)]
      );
      const fence = await runner.query(
        'SELECT "operationId" FROM account_deletion_write_fence WHERE "key" = $1',
        [key]
      );
      if (!Array.isArray(fence) || fence.length !== 0)
        throw new Error('ASSET_MEDIA_DELETION_FENCED');
      const rows = await runner.query(
        'SELECT "id", "profileId", "storagePath", "storageStrategy", "lifecycleState" FROM "asset_entity" WHERE "id" = $1',
        [snapshot.id]
      );
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new Error('ASSET_MEDIA_METADATA_UNAVAILABLE');
      const row = rows[0];
      if (
        row.id !== snapshot.id ||
        row.profileId !== snapshot.profileId ||
        row.storagePath !== snapshot.storagePath ||
        row.storageStrategy !== snapshot.storageStrategy ||
        row.lifecycleState !== 'active'
      )
        throw new Error('ASSET_MEDIA_METADATA_CHANGED');
      handle = await open();
      const underlying = handle;
      return {
        path: underlying.path,
        size: underlying.size,
        createReadStream: (start?: number, end?: number) =>
          underlying.createReadStream(start, end),
        cleanup: () => {
          if (cleanupPromise) return cleanupPromise;
          cleanupPromise = (async () => {
            await underlying.cleanup();
            try {
              await runner.commitTransaction();
              settled = true;
            } catch (error) {
              if (runner.isTransactionActive)
                await runner.rollbackTransaction();
              settled = true;
              throw error;
            } finally {
              if (settled) await runner.release();
            }
          })();
          return cleanupPromise;
        },
      };
    } catch (error) {
      // An unverifiable anonymous plaintext FD keeps its lock until process exit.
      if (error instanceof VerifiedMediaSpoolCleanupError) throw error;
      if (handle) {
        await handle.cleanup();
      }
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
      throw error;
    }
  }
}
