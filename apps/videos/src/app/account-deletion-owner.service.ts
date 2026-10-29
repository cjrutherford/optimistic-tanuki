import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AccountDeletionAction,
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  DELETED_ACCOUNT_ID,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';
import { VideoProcessingService } from './services/video-processing.service';
import { VideoTranscodeClientService } from './services/video-transcode-client.service';
import { videoProcessingDrainKey } from './services/video-deletion-processing-fence.service';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BOUND = 10000;
const channelMatch =
  '(lower(c."userId")=$1 OR lower(c."profileId")=ANY($2::text[]))';

@Injectable()
export class VideosAccountDeletionOwnerService {
  constructor(
    @Inject('VIDEOS_CONNECTION') private readonly database: DataSource,
    private readonly authority: AccountDeletionAuthorityClient,
    private readonly worker: VideoTranscodeClientService,
    private readonly processing: VideoProcessingService
  ) {}

  async execute(
    value: unknown,
    action: AccountDeletionAction
  ): Promise<{ verified: true }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'videos' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw new Error('VIDEO_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const verified = await this.authority.validate(grant, 'videos', action),
      scope = verified.scope;
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw new Error('VIDEO_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds].sort();
    if (action === 'fence') {
      await this.database.transaction(async (manager) => {
        await this.budgets(manager);
        // Match the processing gate's lock order before acquiring producer identities.
        for (const id of profiles)
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
            [videoProcessingDrainKey(id)]
          );
        await this.fresh(grant, scope);
        await installDeletionWriteFence(manager, grant.operationId, [
          { kind: 'account', id: grant.accountId },
          ...profiles.map((id) => ({ kind: 'profile' as const, id })),
        ]);
        await manager.query(
          "SELECT set_config('ot.deletion_operation',$1,true)",
          [grant.operationId]
        );
        await this.inventory(manager, grant.accountId, profiles);
      });
    }
    // Permanent producer fences survive failed output purges; retry retains attribution.
    const inventory = await this.database.transaction(async (manager) => {
      await this.budgets(manager);
      await this.requireFences(manager, grant, profiles);
      return this.inventory(manager, grant.accountId, profiles);
    });
    for (const videoId of inventory.videos) {
      await this.fresh(grant, scope);
      await this.worker.fenceVideo(videoId, grant.operationId);
    }
    await this.fresh(grant, scope);
    await this.processing.purgeDeletionStaging(inventory.videos);
    if (action === 'erase') {
      await this.fresh(grant, scope);
      await this.database.transaction(async (manager) => {
        await this.budgets(manager);
        await this.requireFences(manager, grant, profiles);
        await manager.query(
          "SELECT set_config('ot.deletion_operation',$1,true)",
          [grant.operationId]
        );
        const current = await this.inventory(
          manager,
          grant.accountId,
          profiles
        );
        if (JSON.stringify(current) !== JSON.stringify(inventory))
          throw new Error('VIDEO_DELETION_INVENTORY_CHANGED');
        const args = [grant.accountId, profiles];
        // Remove only the requesting account's participation, not every viewer/subscriber.
        await manager.query(
          'DELETE FROM video_view WHERE lower("userId")=$1 OR lower("profileId")=ANY($2::text[])',
          args
        );
        await manager.query(
          'DELETE FROM channel_subscription WHERE lower("userId")=$1 OR lower("profileId")=ANY($2::text[])',
          args
        );
        const live = await manager.query(
          'SELECT id FROM live_session WHERE lower("startedByUserId")=$1 AND lower("startedByProfileId")=ANY($2::text[]) ORDER BY id',
          args
        );
        const liveIds = live.map((r: { id: string }) => r.id);
        await manager.query(
          'UPDATE channel_feed SET "activeLiveSessionId"=NULL WHERE "activeLiveSessionId"=ANY($1::uuid[])',
          [liveIds]
        );
        await manager.query(
          'DELETE FROM live_session WHERE id=ANY($1::uuid[])',
          [liveIds]
        );
        // Unlink shared references while retaining their authors' text and identity.
        await manager.query(
          'UPDATE live_session SET "channelId"=NULL WHERE "channelId"=ANY($1::uuid[])',
          [current.channels]
        );
        await manager.query(
          'UPDATE program_block SET "videoId"=NULL WHERE "videoId"=ANY($1::uuid[]) AND NOT ("channelId"=ANY($2::uuid[]))',
          [current.videos, current.channels]
        );
        await manager.query(
          'UPDATE channel_feed SET "activeVideoId"=NULL WHERE "activeVideoId"=ANY($1::uuid[])',
          [current.videos]
        );
        await manager.query(
          'UPDATE channel_feed SET "activeProgramBlockId"=NULL WHERE "activeProgramBlockId" IN (SELECT id FROM program_block WHERE "channelId"=ANY($1::uuid[]))',
          [current.channels]
        );
        await manager.query(
          'DELETE FROM program_block WHERE "channelId"=ANY($1::uuid[])',
          [current.channels]
        );
        await manager.query(
          'DELETE FROM channel_feed WHERE "channelId"=ANY($1::uuid[])',
          [current.channels]
        );
        // A viewer-owned history row keeps an inert, content-free FK placeholder.
        await manager.query(
          'DELETE FROM video v WHERE v.id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM video_view x WHERE x."videoId"=v.id)',
          [current.videos]
        );
        await manager.query(
          `UPDATE video SET title='Deleted account',description=NULL,"assetId"=$2,"sourceAssetId"=NULL,"playbackAssetId"=NULL,"hlsManifestAssetId"=NULL,"thumbnailAssetId"=NULL,"communityId"=NULL,"durationSeconds"=NULL,resolution=NULL,encoding=NULL,"processingStatus"='failed',"processingError"=NULL,"viewCount"=0,"likeCount"=0,visibility='private',"publishedAt"=NULL WHERE id=ANY($1::uuid[])`,
          [current.videos, DELETED_ACCOUNT_ID]
        );
        await manager.query(
          'DELETE FROM channel c WHERE c.id=ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM video v WHERE v."channelId"=c.id) AND NOT EXISTS (SELECT 1 FROM channel_subscription s WHERE s."channelId"=c.id)',
          [current.channels]
        );
        await manager.query(
          `UPDATE channel SET name='Deleted account',description=NULL,"profileId"=$2,"userId"=$2,"communitySlug"=NULL,"joinPolicy"='closed',"memberCount"=0,"isPublic"=false,timezone=NULL,"bannerAssetId"=NULL,"avatarAssetId"=NULL WHERE id=ANY($1::uuid[])`,
          [current.channels, DELETED_ACCOUNT_ID]
        );
      });
    }
    if (action !== 'fence') {
      await this.fresh(grant, scope);
      const remaining = await this.database.transaction(async (manager) => {
        await this.budgets(manager);
        await this.requireFences(manager, grant, profiles);
        return this.inventory(manager, grant.accountId, profiles);
      });
      if (
        remaining.channels.length ||
        remaining.videos.length ||
        remaining.interactions
      )
        throw new Error('VIDEO_DELETION_READBACK_NONEMPTY');
    }
    await this.fresh(grant, scope);
    return { verified: true };
  }

  private async fresh(
    grant: AccountDeletionGrant,
    scope: AccountDeletionIdentityDomains
  ) {
    const value = await this.authority.validate(grant, 'videos', grant.action);
    if (JSON.stringify(value.scope) !== JSON.stringify(scope))
      throw new Error('VIDEO_DELETION_SCOPE_CHANGED');
  }
  private async budgets(manager: EntityManager) {
    await manager.query("SET LOCAL lock_timeout='4s'");
    await manager.query("SET LOCAL statement_timeout='8s'");
  }
  private async requireFences(
    manager: EntityManager,
    grant: AccountDeletionGrant,
    profiles: string[]
  ) {
    // Re-install is idempotent, checks ownership and serializes with OLD/NEW writers.
    await installDeletionWriteFence(manager, grant.operationId, [
      { kind: 'account', id: grant.accountId },
      ...profiles.map((id) => ({ kind: 'profile' as const, id })),
    ]);
  }
  private async bounded(
    manager: EntityManager,
    sql: string,
    args: unknown[]
  ): Promise<Record<string, unknown>[]> {
    const rows = await manager.query(`${sql} LIMIT ${BOUND + 1}`, args);
    if (!Array.isArray(rows) || rows.length > BOUND)
      throw new Error('VIDEO_DELETION_INVENTORY_BOUND');
    return rows;
  }
  private async inventory(
    manager: EntityManager,
    account: string,
    profiles: string[]
  ) {
    const args = [account, profiles];
    const channels = await this.bounded(
      manager,
      `SELECT c.id,c."userId",c."profileId" FROM channel c WHERE ${channelMatch} ORDER BY c.id`,
      args
    );
    for (const row of channels)
      if (
        row['userId'] !== account ||
        !profiles.includes(String(row['profileId']))
      )
        throw new Error('VIDEO_DELETION_BINDING_CONFLICT');
    let interactions = 0;
    for (const [table, user, profile, nullable] of [
      ['video_view', 'userId', 'profileId', true],
      ['channel_subscription', 'userId', 'profileId', false],
      ['live_session', 'startedByUserId', 'startedByProfileId', false],
    ] as const) {
      const rows = await this.bounded(
        manager,
        `SELECT id,"${user}" AS account,"${profile}" AS profile FROM "${table}" WHERE lower("${user}")=$1 OR lower("${profile}")=ANY($2::text[]) ORDER BY id`,
        args
      );
      for (const row of rows)
        if (
          ((!nullable || row['account'] != null) &&
            row['account'] !== account) ||
          ((!nullable || row['profile'] != null) &&
            !profiles.includes(String(row['profile'])))
        )
          throw new Error('VIDEO_DELETION_BINDING_CONFLICT');
      interactions += rows.length;
    }
    const videos = await this.bounded(
      manager,
      `SELECT v.id FROM video v JOIN channel c ON c.id=v."channelId" WHERE ${channelMatch} ORDER BY v.id`,
      args
    );
    // Every family changed by erasure must fit the same explicit row budget.
    for (const table of ['channel_feed', 'program_block', 'live_session']) {
      await this.bounded(
        manager,
        `SELECT x.id FROM "${table}" x JOIN channel c ON c.id=x."channelId" WHERE ${channelMatch} ORDER BY x.id`,
        args
      );
    }
    const selectedVideos = `SELECT v.id FROM video v JOIN channel c ON c.id=v."channelId" WHERE ${channelMatch}`;
    await this.bounded(
      manager,
      `SELECT f.id FROM channel_feed f WHERE f."activeVideoId" IN (${selectedVideos}) OR f."activeProgramBlockId" IN (SELECT p.id FROM program_block p JOIN channel c ON c.id=p."channelId" WHERE ${channelMatch}) OR f."activeLiveSessionId" IN (SELECT l.id FROM live_session l WHERE lower(l."startedByUserId")=$1 AND lower(l."startedByProfileId")=ANY($2::text[])) ORDER BY f.id`,
      args
    );
    await this.bounded(
      manager,
      `SELECT p.id FROM program_block p WHERE p."videoId" IN (${selectedVideos}) ORDER BY p.id`,
      args
    );
    const ids = (rows: Record<string, unknown>[]) =>
      rows.map((row) => {
        const id = row['id'];
        if (typeof id !== 'string' || !UUID.test(id))
          throw new Error('VIDEO_DELETION_ID_INVALID');
        return id;
      });
    return { channels: ids(channels), videos: ids(videos), interactions };
  }
}
