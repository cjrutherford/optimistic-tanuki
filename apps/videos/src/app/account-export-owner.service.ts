import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthCommands,
  VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerChunk,
  AccountExportOwnerRecord,
  AccountExportSnapshotDescriptor,
  AccountExportOwnerFailureCode,
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  isAccountExportCaptureGrant,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerEmitter,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

export const VIDEOS_ACCOUNT_EXPORT_SOURCES =
  VIDEOS_ACCOUNT_EXPORT_CAPTURE_SOURCES;
export type VideosAccountExportSource =
  (typeof VIDEOS_ACCOUNT_EXPORT_SOURCES)[number];
export type VideosAccountExportChunk =
  AccountExportOwnerChunk<VideosAccountExportSource>;
export interface VideosAccountExportOptions {
  grant: AccountExportCaptureGrant;
  profileSnapshot: AccountExportSnapshotDescriptor;
  onChunk: (
    chunk: VideosAccountExportChunk,
    signal?: AbortSignal
  ) => Promise<void>;
  signal?: AbortSignal;
  captureTimeoutMs?: number;
}
export class VideosAccountExportOwnerError extends Error {
  constructor(readonly code: AccountExportOwnerFailureCode | string) {
    super(code);
    this.name = 'VideosAccountExportOwnerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 200;
const text = (alias: string, column: string, limit: number, output = column) =>
  `left(${alias}."${column}"::text,${
    limit + 1
  }) "${output}",char_length(${alias}."${column}"::text) "${output}Length"`;
const TEXT_LIMITS: Record<string, number> = {
  nameLength: 200,
  titleLength: 200,
  descriptionLength: 65536,
  profileIdLength: 36,
  userIdLength: 36,
  communityIdLength: 256,
  channelCommunityIdLength: 256,
  assetIdLength: 256,
  sourceAssetIdLength: 256,
  playbackAssetIdLength: 256,
  hlsManifestAssetIdLength: 256,
  thumbnailAssetIdLength: 256,
  bannerAssetIdLength: 256,
  avatarAssetIdLength: 256,
  communitySlugLength: 120,
  timezoneLength: 100,
  resolutionLength: 100,
  encodingLength: 100,
  joinPolicyLength: 64,
  appScopeLength: 120,
  currentModeLength: 20,
  blockTypeLength: 20,
  statusLength: 20,
  visibilityLength: 20,
  processingStatusLength: 20,
  startedByUserIdLength: 36,
  startedByProfileIdLength: 36,
};
const SELECTS: Record<VideosAccountExportSource, (temp: string) => string> = {
  channel: (t) =>
    `SELECT c."id"::text id,${text('c', 'name', 200)},${text(
      'c',
      'description',
      65536
    )},${text('c', 'profileId', 36)},${text('c', 'userId', 36)},${text(
      'c',
      'communityId',
      256
    )},${text('c', 'communitySlug', 120)},${text('c', 'joinPolicy', 64)},${text(
      'c',
      'appScope',
      120
    )},c."memberCount" "memberCount",c."isPublic" "isPublic",${text(
      'c',
      'timezone',
      100
    )},${text('c', 'bannerAssetId', 256)},${text(
      'c',
      'avatarAssetId',
      256
    )},c."createdAt"::text "createdAt",c."updatedAt"::text "updatedAt" FROM "channel" c WHERE (lower(c."userId")=$1 OR lower(c."profileId") IN (SELECT id::text FROM "${t}")) AND ($2::uuid IS NULL OR c."id">$2::uuid) ORDER BY c."id" LIMIT $3`,
  video: (t) =>
    `SELECT v."id"::text id,${text('v', 'title', 200)},${text(
      'v',
      'description',
      65536
    )},${text('v', 'assetId', 256)},${text('v', 'sourceAssetId', 256)},${text(
      'v',
      'playbackAssetId',
      256
    )},${text('v', 'hlsManifestAssetId', 256)},${text(
      'v',
      'thumbnailAssetId',
      256
    )},v."channelId"::text "channelId",${text(
      'v',
      'communityId',
      256
    )},v."durationSeconds" "durationSeconds",${text(
      'v',
      'resolution',
      100
    )},${text('v', 'encoding', 100)},${text(
      'v',
      'processingStatus',
      20
    )},v."viewCount" "viewCount",v."likeCount" "likeCount",${text(
      'v',
      'visibility',
      20
    )},v."createdAt"::text "createdAt",v."updatedAt"::text "updatedAt",v."publishedAt"::text "publishedAt",${text(
      'c',
      'communityId',
      256,
      'channelCommunityId'
    )} FROM "video" v JOIN "channel" c ON c."id"=v."channelId" WHERE (lower(c."userId")=$1 OR lower(c."profileId") IN (SELECT id::text FROM "${t}")) AND ($2::uuid IS NULL OR v."id">$2::uuid) ORDER BY v."id" LIMIT $3`,
  channelSubscription: (t) =>
    `SELECT s."id"::text id,s."channelId"::text "channelId",s."subscribedAt"::text "subscribedAt",${text(
      's',
      'userId',
      36
    )},${text('s', 'profileId', 36)},${text(
      'c',
      'communityId',
      256,
      'channelCommunityId'
    )} FROM "channel_subscription" s JOIN "channel" c ON c."id"=s."channelId" WHERE (lower(s."userId")=$1 OR lower(s."profileId") IN (SELECT id::text FROM "${t}")) AND ($2::uuid IS NULL OR s."id">$2::uuid) ORDER BY s."id" LIMIT $3`,
  videoView: (t) =>
    `SELECT x."id"::text id,x."videoId"::text "videoId",${text(
      'x',
      'userId',
      36
    )},${text(
      'x',
      'profileId',
      36
    )},x."watchDurationSeconds" "watchDurationSeconds",x."viewedAt"::text "viewedAt" FROM "video_view" x WHERE (lower(x."userId")=$1 OR lower(x."profileId") IN (SELECT id::text FROM "${t}")) AND ($2::uuid IS NULL OR x."id">$2::uuid) ORDER BY x."id" LIMIT $3`,
  channelFeed: (t) =>
    `SELECT f."id"::text id,f."channelId"::text "channelId",${text(
      'f',
      'communityId',
      256
    )},${text('f', 'timezone', 100)},${text(
      'f',
      'currentMode',
      20
    )},f."activeProgramBlockId"::text "activeProgramBlockId",f."activeLiveSessionId"::text "activeLiveSessionId",f."activeVideoId"::text "activeVideoId",f."lastTransitionAt"::text "lastTransitionAt",f."createdAt"::text "createdAt",f."updatedAt"::text "updatedAt",${text(
      'c',
      'communityId',
      256,
      'channelCommunityId'
    )} FROM "channel_feed" f JOIN "channel" c ON c."id"=f."channelId" WHERE (lower(c."userId")=$1 OR lower(c."profileId") IN (SELECT id::text FROM "${t}")) AND ($2::uuid IS NULL OR f."id">$2::uuid) ORDER BY f."id" LIMIT $3`,
  programBlock: (t) =>
    `SELECT p."id"::text id,p."channelId"::text "channelId",${text(
      'p',
      'communityId',
      256
    )},p."videoId"::text "videoId",${text('p', 'blockType', 20)},${text(
      'p',
      'title',
      200
    )},${text('p', 'description', 65536)},${text(
      'p',
      'status',
      20
    )},p."startsAt"::text "startsAt",p."endsAt"::text "endsAt",p."actualStartAt"::text "actualStartAt",p."actualEndAt"::text "actualEndAt",p."createdAt"::text "createdAt",p."updatedAt"::text "updatedAt",${text(
      'c',
      'communityId',
      256,
      'channelCommunityId'
    )} FROM "program_block" p JOIN "channel" c ON c."id"=p."channelId" WHERE (lower(c."userId")=$1 OR lower(c."profileId") IN (SELECT id::text FROM "${t}")) AND ($2::uuid IS NULL OR p."id">$2::uuid) ORDER BY p."id" LIMIT $3`,
  liveSession: (t) =>
    `SELECT l."id"::text id,${text(
      'l',
      'communityId',
      256
    )},l."channelId"::text "channelId",${text('l', 'title', 200)},${text(
      'l',
      'description',
      65536
    )},${text(
      'l',
      'status',
      20
    )},l."startedAt"::text "startedAt",l."endedAt"::text "endedAt",${text(
      'l',
      'thumbnailAssetId',
      256
    )},l."createdAt"::text "createdAt",l."updatedAt"::text "updatedAt",${text(
      'l',
      'startedByUserId',
      36
    )},${text('l', 'startedByProfileId', 36)},${text(
      'c',
      'communityId',
      256,
      'channelCommunityId'
    )} FROM "live_session" l LEFT JOIN "channel" c ON c."id"=l."channelId" WHERE ((lower(l."startedByUserId")=$1 OR lower(l."startedByProfileId") IN (SELECT id::text FROM "${t}")) OR (lower(c."userId")=$1 OR lower(c."profileId") IN (SELECT id::text FROM "${t}"))) AND ($2::uuid IS NULL OR l."id">$2::uuid) ORDER BY l."id" LIMIT $3`,
};

/** Transaction-consistent, lease-bound export of Videos-owned metadata. */
@Injectable()
export class VideosAccountExportOwnerService {
  private busy = false;
  private quarantined = false;
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: AccountExportProfileSnapshotClient,
    private readonly authClient: ClientProxy
  ) {}

  async captureAccount(
    value: VideosAccountExportOptions
  ): Promise<VideosAccountExportChunk> {
    if (this.busy || this.quarantined)
      throw new VideosAccountExportOwnerError('OWNER_READ_FAILED');
    if (
      !value ||
      !isAccountExportCaptureGrant(value.grant) ||
      !this.validDescriptor(value.profileSnapshot) ||
      value.profileSnapshot.accountId !== value.grant.accountId ||
      typeof value.onChunk !== 'function'
    )
      throw new VideosAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    const grant: AccountExportCaptureGrant = {
      accountId: value.grant.accountId.toLowerCase(),
      appId: value.grant.appId,
      token: value.grant.token,
      jobId: value.grant.jobId,
      attempt: value.grant.attempt,
      leaseOwner: value.grant.leaseOwner,
    };
    const d = value.profileSnapshot;
    const descriptor: AccountExportSnapshotDescriptor = {
      handleId: d.handleId,
      participantId: d.participantId,
      accountId: d.accountId,
      captureId: d.captureId,
      snapshotAt: d.snapshotAt,
      sizeBytes: d.sizeBytes,
      sha256: d.sha256,
      rowCount: d.rowCount,
      sources: [...d.sources],
      sourceRowCounts: { ...d.sourceRowCounts },
      sourceDispositions: { ...d.sourceDispositions },
      identityCount: d.identityCount,
      expiresAt: d.expiresAt,
    };
    const onChunk = value.onChunk;
    const external = value.signal;
    const timeoutMs = value.captureTimeoutMs ?? 45_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45_000)
      throw new VideosAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    this.busy = true;
    const abort = new AbortController();
    const deadline = Date.now() + timeoutMs;
    const forward = () => abort.abort();
    external?.addEventListener('abort', forward, { once: true });
    if (external?.aborted) abort.abort();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    timer.unref?.();
    let runner: QueryRunner | undefined;
    let temp = '';
    let transaction = false;
    let clean = true;
    try {
      await this.lease(grant, abort.signal, deadline);
      runner = this.dataSource.createQueryRunner();
      await runner.connect();
      this.active(abort.signal, deadline);
      temp = `videos_export_scope_${randomUUID().replace(/-/g, '')}`;
      await runner.query(
        `CREATE TEMP TABLE "${temp}" (id uuid PRIMARY KEY) ON COMMIT PRESERVE ROWS`
      );
      await runner.startTransaction('REPEATABLE READ');
      transaction = true;
      await runner.query('SET TRANSACTION READ ONLY');
      await runner.query(`SET LOCAL statement_timeout = '10s'`);
      await runner.query(`SET LOCAL lock_timeout = '2s'`);
      const [clock] = await this.query(
        runner,
        'SELECT transaction_timestamp()::text "snapshotAt"',
        [],
        abort.signal,
        deadline
      );
      if (
        typeof clock?.snapshotAt !== 'string' ||
        !Number.isFinite(Date.parse(clock.snapshotAt))
      )
        throw new Error();
      await this.identities.readIdentities(
        grant,
        descriptor,
        async (ids) => {
          this.active(abort.signal, deadline);
          if (
            !Array.isArray(ids) ||
            ids.length > 100 ||
            ids.some((id) => !UUID.test(id))
          )
            throw new VideosAccountExportOwnerError(
              'OWNER_RELATIONSHIP_AMBIGUOUS'
            );
          if (ids.length)
            await this.query(
              runner!,
              `INSERT INTO "${temp}" (id) SELECT unnest($1::uuid[])`,
              [ids],
              abort.signal,
              deadline
            );
        },
        abort.signal
      );
      const emitter = new AccountExportOwnerEmitter<VideosAccountExportSource>(
        {
          participantId: 'videos',
          accountId: grant.accountId,
          captureId: randomUUID(),
          snapshotAt: clock.snapshotAt,
          sources: VIDEOS_ACCOUNT_EXPORT_SOURCES,
          signal: abort.signal,
        },
        async (chunk) => {
          await this.lease(grant, abort.signal, deadline);
          this.active(abort.signal, deadline);
          try {
            await onChunk(chunk, abort.signal);
          } catch {
            throw new VideosAccountExportOwnerError(
              'OWNER_STREAM_CONSUMER_FAILED'
            );
          }
          this.active(abort.signal, deadline);
        }
      );
      await emitter.emitSources(
        Object.fromEntries(
          VIDEOS_ACCOUNT_EXPORT_SOURCES.map((source) => [
            source,
            () =>
              this.source(
                runner!,
                temp,
                source,
                grant.accountId,
                abort.signal,
                deadline
              ),
          ])
        ) as any
      );
      this.active(abort.signal, deadline);
      await runner.commitTransaction();
      transaction = false;
      await runner.query(`DROP TABLE IF EXISTS "${temp}"`);
      temp = '';
      await runner.release();
      runner = undefined;
      await this.lease(grant, abort.signal, deadline);
      this.active(abort.signal, deadline);
      return await emitter.complete();
    } catch (error) {
      if (abort.signal.aborted)
        throw new VideosAccountExportOwnerError(
          external?.aborted ? 'OWNER_CAPTURE_ABORTED' : 'OWNER_CAPTURE_TIMEOUT'
        );
      if (error instanceof VideosAccountExportOwnerError) throw error;
      throw new VideosAccountExportOwnerError('OWNER_READ_FAILED');
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', forward);
      if (runner) {
        try {
          if (transaction) await runner.rollbackTransaction();
        } catch {
          clean = false;
        }
        try {
          if (temp) await runner.query(`DROP TABLE IF EXISTS "${temp}"`);
        } catch {
          clean = false;
        }
        if (clean) {
          try {
            await runner.release();
          } catch {
            clean = false;
          }
        }
        if (!clean) {
          this.quarantined = true;
          const evict = (runner as any).releasePostgresConnection;
          if (typeof evict === 'function')
            try {
              await evict.call(
                runner,
                new Error('VIDEOS_ACCOUNT_EXPORT_CLEANUP_FAILED')
              );
            } catch {
              /* provider remains quarantined */
            }
        }
      }
      if (!clean) this.quarantined = true;
      this.busy = false;
    }
  }

  private async *source(
    r: QueryRunner,
    temp: string,
    source: VideosAccountExportSource,
    account: string,
    signal: AbortSignal,
    deadline: number
  ): AsyncIterable<AccountExportOwnerRecord<VideosAccountExportSource>> {
    // Queries are added per source below; keyset pagination always includes the minimum UUID.
    let cursor: string | null = null;
    while (true) {
      const rows = await this.query(
        r,
        SELECTS[source](temp),
        [account, cursor, PAGE + 1],
        signal,
        deadline
      );
      for (const raw of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        const row = raw as Record<string, unknown>;
        for (const key of [
          'userId',
          'profileId',
          'startedByUserId',
          'startedByProfileId',
        ]) {
          const value = row[key];
          if (value != null && !UUID.test(String(value)))
            throw new VideosAccountExportOwnerError(
              'OWNER_RELATIONSHIP_AMBIGUOUS'
            );
        }
        const profileOwned =
          typeof row.profileId === 'string' &&
          (await this.profileHas(r, temp, row.profileId, signal, deadline));
        const oversized = Object.entries(TEXT_LIMITS).some(
          ([key, max]) =>
            row[key] != null &&
            (!Number.isSafeInteger(Number(row[key])) || Number(row[key]) > max)
        );
        if (!UUID.test(String(row.id)) || oversized)
          throw new VideosAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        if (
          source === 'channel' &&
          (String(row.userId).toLowerCase() !== account || !profileOwned)
        )
          throw new VideosAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        if (
          source === 'channelSubscription' &&
          (String(row.userId).toLowerCase() !== account || !profileOwned)
        )
          throw new VideosAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        if (
          source === 'videoView' &&
          ((row.userId != null &&
            String(row.userId).toLowerCase() !== account) ||
            (row.profileId != null && !profileOwned))
        )
          throw new VideosAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        if (
          ['video', 'channelFeed', 'programBlock'].includes(source) &&
          row.communityId != null &&
          row.communityId !== row.channelCommunityId
        )
          throw new VideosAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        if (
          source === 'video' &&
          !['ready', 'failed'].includes(String(row.processingStatus))
        )
          throw new VideosAccountExportOwnerError('OWNER_READ_FAILED');
        let data = Object.fromEntries(
          Object.entries(row).filter(
            ([key]) =>
              !key.endsWith('Length') &&
              key !== 'channelCommunityId' &&
              key !== 'userId' &&
              (key !== 'profileId' || source === 'channel')
          )
        );
        if (typeof data.profileId === 'string')
          data.profileId = data.profileId.toLowerCase();
        for (const [key, value] of Object.entries(data)) {
          if (
            /At$/.test(key) &&
            value != null &&
            (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
          )
            throw new VideosAccountExportOwnerError(
              'OWNER_RELATIONSHIP_AMBIGUOUS'
            );
        }
        for (const key of [
          'memberCount',
          'durationSeconds',
          'viewCount',
          'likeCount',
          'watchDurationSeconds',
        ]) {
          if (
            data[key] != null &&
            (!Number.isSafeInteger(Number(data[key])) || Number(data[key]) < 0)
          )
            throw new VideosAccountExportOwnerError(
              'OWNER_RELATIONSHIP_AMBIGUOUS'
            );
        }
        if (source === 'liveSession') {
          const userMatch =
            String(row.startedByUserId).toLowerCase() === account;
          const profileMatch = await this.profileHas(
            r,
            temp,
            String(row.startedByProfileId),
            signal,
            deadline
          );
          if ((userMatch || profileMatch) && !(userMatch && profileMatch))
            throw new VideosAccountExportOwnerError(
              'OWNER_RELATIONSHIP_AMBIGUOUS'
            );
          const own = userMatch && profileMatch;
          if (own) {
            data.startedByUserId = String(row.startedByUserId).toLowerCase();
            data.startedByProfileId = String(
              row.startedByProfileId
            ).toLowerCase();
          }
          if (
            row.channelId != null &&
            row.channelCommunityId !== row.communityId
          )
            throw new VideosAccountExportOwnerError(
              'OWNER_RELATIONSHIP_AMBIGUOUS'
            );
          if (!own) {
            delete data.startedByUserId;
            delete data.startedByProfileId;
          }
        }
        yield { source, data };
        cursor = String(row.id);
      }
      if (rows.length <= PAGE) break;
    }
  }
  private async query(
    r: QueryRunner,
    sql: string,
    params: unknown[],
    signal: AbortSignal,
    deadline: number
  ) {
    this.active(signal, deadline);
    try {
      const rows = await r.query(sql, params);
      this.active(signal, deadline);
      return rows as Record<string, unknown>[];
    } catch {
      throw new VideosAccountExportOwnerError('OWNER_READ_FAILED');
    }
  }
  private async profileHas(
    r: QueryRunner,
    temp: string,
    id: string,
    signal: AbortSignal,
    deadline: number
  ) {
    if (!UUID.test(id)) return false;
    return (
      (
        await this.query(
          r,
          `SELECT 1 FROM "${temp}" WHERE id=$1::uuid`,
          [id],
          signal,
          deadline
        )
      ).length > 0
    );
  }
  private async lease(
    grant: AccountExportCaptureGrant,
    signal: AbortSignal,
    deadline: number
  ) {
    this.active(signal, deadline);
    try {
      const response = await firstValueFrom(
        this.authClient
          .send({ cmd: AuthCommands.ValidateAccountExportLease }, grant)
          .pipe(timeout(3000))
      );
      this.active(signal, deadline);
      if (
        !response ||
        Object.keys(response).length !== 1 ||
        response.valid !== true
      )
        throw new Error();
    } catch {
      throw new VideosAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    }
  }
  private active(signal: AbortSignal, deadline: number) {
    if (signal.aborted || Date.now() >= deadline)
      throw new VideosAccountExportOwnerError(
        Date.now() >= deadline
          ? 'OWNER_CAPTURE_TIMEOUT'
          : 'OWNER_CAPTURE_ABORTED'
      );
  }
  private validDescriptor(d: any): d is AccountExportSnapshotDescriptor {
    return (
      !!d &&
      d.participantId === 'profile' &&
      UUID.test(d.accountId) &&
      UUID.test(d.captureId) &&
      UUID.test(d.handleId) &&
      Array.isArray(d.sources) &&
      Number.isSafeInteger(d.identityCount) &&
      d.identityCount >= 0 &&
      d.identityCount <=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize *
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages &&
      typeof d.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(d.sha256) &&
      Number.isFinite(Date.parse(d.snapshotAt)) &&
      Number.isFinite(Date.parse(d.expiresAt))
    );
  }
}
