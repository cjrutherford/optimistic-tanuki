import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const videoProcessingDrainKey = (profileId: string) =>
  `ot-video-processing-v1:${deletionIdentityKey('profile', profileId)}`;

/** The lease covers transcode/import work, not just the processing-status write. */
@Injectable()
export class VideoDeletionProcessingFenceService {
  constructor(
    @Inject('VIDEOS_CONNECTION') private readonly database: DataSource
  ) {}

  async run(
    videoId: string,
    work: (profileId: string) => Promise<void>
  ): Promise<void> {
    if (!UUID.test(videoId)) throw new Error('VIDEO_PROCESSING_ID_INVALID');
    const runner = this.database.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const select =
        'SELECT c."profileId", c."userId" FROM video v JOIN channel c ON c.id=v."channelId" WHERE v.id=$1';
      const rows = await runner.query(select, [videoId]);
      if (!Array.isArray(rows))
        throw new Error('VIDEO_PROCESSING_BINDING_INVALID');
      if (!rows.length) {
        await runner.commitTransaction();
        return;
      }
      const owner = rows[0];
      if (
        rows.length !== 1 ||
        !UUID.test(owner.profileId) ||
        !UUID.test(owner.userId)
      )
        throw new Error('VIDEO_PROCESSING_BINDING_INVALID');
      await runner.query(
        'SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))',
        [videoProcessingDrainKey(owner.profileId)]
      );
      const fresh = await runner.query(select, [videoId]);
      if (
        !Array.isArray(fresh) ||
        fresh.length !== 1 ||
        fresh[0].profileId !== owner.profileId ||
        fresh[0].userId !== owner.userId
      )
        throw new Error('VIDEO_PROCESSING_BINDING_CHANGED');
      const fenced = await runner.query(
        'SELECT "key" FROM account_deletion_write_fence WHERE "key"=ANY($1::text[])',
        [
          [
            deletionIdentityKey('account', owner.userId),
            deletionIdentityKey('profile', owner.profileId),
          ],
        ]
      );
      if (!Array.isArray(fenced) || fenced.length)
        throw new Error('VIDEO_PROCESSING_DELETION_FENCED');
      await work(owner.profileId);
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
