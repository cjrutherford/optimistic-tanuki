import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AccountExportArtifactStoreService,
  ArtifactDescriptor,
} from '@optimistic-tanuki/storage';
import { Repository } from 'typeorm';
import { AccountExportDownloadService } from './account-export-download.service';
import { AccountExportJobEntity } from './entities/account-export-job.entity';

const APPS = ['client-interface', 'local-hub'];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const MAX_BATCH = 25;
const MAX_ACCOUNT_PURGE = 10_000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

@Injectable()
export class AccountExportArtifactRetentionService
  implements OnModuleInit, OnModuleDestroy
{
  private initialTimer?: ReturnType<typeof setTimeout>;
  private interval?: ReturnType<typeof setInterval>;
  private closing = false;
  private sweeping = false;

  constructor(
    @Inject(getRepositoryToken(AccountExportJobEntity))
    private readonly jobs: Repository<AccountExportJobEntity>,
    private readonly store: AccountExportArtifactStoreService,
    private readonly downloads: AccountExportDownloadService
  ) {}

  onModuleInit(): void {
    this.initialTimer = setTimeout(() => {
      this.initialTimer = undefined;
      void this.sweep().catch(() => undefined);
      this.interval = setInterval(
        () => void this.sweep().catch(() => undefined),
        60_000
      );
      this.interval.unref?.();
    }, 1_000);
    this.initialTimer.unref?.();
  }

  onModuleDestroy(): void {
    this.closing = true;
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.interval) clearInterval(this.interval);
    this.initialTimer = undefined;
    this.interval = undefined;
  }

  async sweep(): Promise<{ removed: number; failed: number }> {
    if (this.closing || this.sweeping) return { removed: 0, failed: 0 };
    this.sweeping = true;
    let removed = 0;
    let failed = 0;
    try {
      const candidates = await this.jobs
        .createQueryBuilder('job')
        .where(
          `job.kind = :kind AND job.appId IN (:...apps) AND jsonb_exists("job"."coverageSummary", 'privateArtifact') AND (job.state <> :running OR job.leaseExpiresAt IS NULL OR job.leaseExpiresAt <= clock_timestamp()) AND "job"."coverageSummary"->'privateArtifact'->>'expiresAt' <= :now`,
          {
            kind: 'export',
            apps: APPS,
            running: 'running',
            now: new Date().toISOString(),
          }
        )
        .orderBy('job.createdAt', 'ASC')
        .take(MAX_BATCH)
        .getMany();
      for (const candidate of candidates) {
        if (this.closing) break;
        try {
          const outcome = await this.removeLocked(candidate.id, false);
          if (outcome === 'removed') removed++;
          if (outcome === 'failed') failed++;
        } catch {
          failed++;
        }
      }
      try {
        await this.store.sweepExpiredTemps(Date.now() - 3_600_000);
      } catch {
        failed++;
      }
      try {
        await this.pruneHistory();
      } catch {
        failed++;
      }
      return { removed, failed };
    } finally {
      this.sweeping = false;
    }
  }

  /** Terminal history is eligible only after custody metadata has been cleared.
   * Missing/malformed descriptors remain visible to cleanup; never drop that intent. */
  async pruneHistory(): Promise<{ removed: number; remaining: number }> {
    const raw = await this.jobs.manager.query(
      `WITH history_due AS (SELECT "id" FROM "account_export_jobs"
       WHERE "kind"='export' AND "appId" IN ('client-interface','local-hub')
       AND "state" IN ('complete','failed','incomplete')
       AND COALESCE("completedAt","updatedAt","createdAt")<=clock_timestamp()-interval '90 days'
       AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<=clock_timestamp())
       AND ("coverageSummary"->'privateArtifact' IS NULL OR "coverageSummary"->'privateArtifact'='null'::jsonb)
       AND COALESCE("coverageSummary"->>'artifactState','') NOT IN ('cleanup-pending','assembling')
       ORDER BY COALESCE("completedAt","updatedAt","createdAt"),"id" LIMIT 25 FOR UPDATE SKIP LOCKED)
       DELETE FROM "account_export_jobs" j USING history_due h WHERE j."id"=h."id" RETURNING j."id"`
    );
    if (
      !Array.isArray(raw) ||
      raw.length !== 2 ||
      !Array.isArray(raw[0]) ||
      !Number.isSafeInteger(raw[1]) ||
      raw[1] !== raw[0].length ||
      raw[1] > 25
    )
      throw Error('JOB_HISTORY_DELETE_UNVERIFIED');
    const result = await this.jobs.manager.query(
      `SELECT count(*)::text AS "historyRemaining" FROM "account_export_jobs" WHERE "kind"='export' AND "appId" IN ('client-interface','local-hub') AND "state" IN ('complete','failed','incomplete') AND COALESCE("completedAt","updatedAt","createdAt")<=clock_timestamp()-interval '90 days'`
    );
    const value = result?.[0]?.historyRemaining;
    if (
      !Array.isArray(result) ||
      result.length !== 1 ||
      !/^\d+$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value))
    )
      throw Error('JOB_HISTORY_READBACK_UNVERIFIED');
    return { removed: raw[1], remaining: Number(value) };
  }

  async purgeAccount(
    accountId: string,
    deletionOperationId?: string
  ): Promise<{ removed: number; failed: number }> {
    if (!UUID.test(accountId)) throw new Error('ACCOUNT_ID_INVALID');
    if (deletionOperationId !== undefined && !UUID.test(deletionOperationId))
      throw new Error('DELETION_OPERATION_ID_INVALID');
    let removed = 0;
    let failed = 0;
    const candidates = await this.jobs
      .createQueryBuilder('job')
      .select(['job.id'])
      .where(
        `job.accountId = :accountId AND job.kind = :kind AND job.appId IN (:...apps)`,
        { accountId, kind: 'export', apps: APPS }
      )
      .orderBy('job.createdAt', 'ASC')
      .take(MAX_ACCOUNT_PURGE + 1)
      .getMany();
    if (candidates.length > MAX_ACCOUNT_PURGE)
      throw new Error('ARTIFACT_PURGE_BOUND_EXCEEDED');
    for (const candidate of candidates) {
      try {
        const outcome = await this.removeLocked(
          candidate.id,
          true,
          accountId,
          deletionOperationId
        );
        if (outcome === 'removed') removed++;
        if (
          outcome === 'failed' ||
          (deletionOperationId && outcome === 'skipped')
        )
          failed++;
      } catch {
        failed++;
      }
    }
    try {
      await this.store.sweepExpiredTemps(Date.now() - 3_600_000);
    } catch {
      failed++;
    }
    return { removed, failed };
  }

  private async removeLocked(
    jobId: string,
    accountPurge: boolean,
    expectedAccount?: string,
    deletionOperationId?: string
  ): Promise<'removed' | 'skipped' | 'failed'> {
    return this.jobs.manager.transaction(async (manager) => {
      if (deletionOperationId)
        await manager.query(
          "SELECT set_config('ot.deletion_operation', $1, true)",
          [deletionOperationId]
        );
      const repo = manager.getRepository(AccountExportJobEntity);
      const row = await repo
        .createQueryBuilder('job')
        .setLock('pessimistic_write')
        .where('job.id = :jobId', { jobId })
        .getOne();
      if (
        !row ||
        row.kind !== 'export' ||
        !APPS.includes(row.appId) ||
        (expectedAccount && row.accountId !== expectedAccount)
      )
        return 'skipped';
      const descriptor = readDescriptor(row.coverageSummary?.privateArtifact);
      if (accountPurge && row.coverageSummary?.privateArtifact == null) {
        await this.downloads.invalidateJob(row.id);
        await manager.query(
          `UPDATE "account_export_jobs" SET "state"='failed',"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"lastErrorCode"='account-purge',"coverageSummary"=$2::jsonb WHERE "id"=$1::uuid`,
          [
            row.id,
            JSON.stringify({
              ...row.coverageSummary,
              artifactAvailable: false,
            }),
          ]
        );
        return 'removed';
      }
      if (
        !descriptor ||
        descriptor.jobId !== row.id ||
        descriptor.accountId !== row.accountId ||
        descriptor.appId !== row.appId ||
        descriptor.attempt > row.attempt
      )
        return 'skipped';
      if (!accountPurge) {
        if (Date.parse(descriptor.expiresAt) > Date.now()) return 'skipped';
        const live = await manager.query(
          `SELECT "state"='running' AND "leaseExpiresAt">clock_timestamp() AS live FROM "account_export_jobs" WHERE "id"=$1::uuid`,
          [row.id]
        );
        if (live?.[0]?.live === true) return 'skipped';
      } else if (row.state === 'running') {
        row.state = 'failed';
        row.leaseOwner = null;
        row.leaseExpiresAt = null;
        row.lastErrorCode = 'account-purge';
        row.coverageSummary = {
          ...row.coverageSummary,
          artifactAvailable: false,
          artifactState: 'cleanup-pending',
        };
        await manager.query(
          `UPDATE "account_export_jobs" SET "state"=$2,"leaseOwner"=$3,"leaseExpiresAt"=$4,"lastErrorCode"=$5,"coverageSummary"=$6::jsonb,"updatedAt"=clock_timestamp() WHERE "id"=$1::uuid`,
          [
            row.id,
            row.state,
            row.leaseOwner,
            row.leaseExpiresAt,
            row.lastErrorCode,
            JSON.stringify(row.coverageSummary),
          ]
        );
      }
      try {
        await this.downloads.invalidateJob(row.id);
        await this.store.purgeOwnedArtifact(descriptor, async () => {
          const fresh = await repo.findOne({ where: { id: row.id } });
          if (
            !fresh ||
            fresh.accountId !== row.accountId ||
            fresh.appId !== row.appId ||
            fresh.kind !== 'export'
          )
            return false;
          const latest = readDescriptor(fresh.coverageSummary?.privateArtifact);
          if (
            !latest ||
            JSON.stringify(latest) !== JSON.stringify(descriptor) ||
            latest.jobId !== fresh.id ||
            latest.accountId !== fresh.accountId ||
            latest.appId !== fresh.appId ||
            latest.attempt > fresh.attempt
          )
            return false;
          if (accountPurge)
            return (
              fresh.state !== 'running' &&
              fresh.leaseOwner === null &&
              fresh.leaseExpiresAt === null
            );
          const lease = await manager.query(
            `SELECT "state"='running' AND "leaseExpiresAt">clock_timestamp() AS live FROM "account_export_jobs" WHERE "id"=$1::uuid`,
            [fresh.id]
          );
          return (
            lease?.[0]?.live !== true &&
            Date.parse(latest.expiresAt) <= Date.now()
          );
        });
      } catch (error) {
        row.coverageSummary = {
          ...row.coverageSummary,
          privateArtifact: descriptor,
          artifactAvailable: false,
          artifactState: 'cleanup-pending',
        };
        await manager.query(
          `UPDATE "account_export_jobs" SET "state"=$2,"leaseOwner"=$3,"leaseExpiresAt"=$4,"lastErrorCode"=$5,"coverageSummary"=$6::jsonb,"updatedAt"=clock_timestamp() WHERE "id"=$1::uuid`,
          [
            row.id,
            row.state,
            row.leaseOwner,
            row.leaseExpiresAt,
            row.lastErrorCode,
            JSON.stringify(row.coverageSummary),
          ]
        );
        return 'failed';
      }
      const summary = { ...row.coverageSummary };
      delete summary.privateArtifact;
      row.coverageSummary = {
        ...summary,
        artifactAvailable: false,
        artifactState: 'expired',
      };
      await manager.query(
        `UPDATE "account_export_jobs" SET "state"=$2,"leaseOwner"=$3,"leaseExpiresAt"=$4,"lastErrorCode"=$5,"coverageSummary"=$6::jsonb,"updatedAt"=clock_timestamp() WHERE "id"=$1::uuid`,
        [
          row.id,
          row.state,
          row.leaseOwner,
          row.leaseExpiresAt,
          row.lastErrorCode,
          JSON.stringify(row.coverageSummary),
        ]
      );
      return 'removed';
    });
  }
}

function readDescriptor(value: unknown): ArtifactDescriptor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Record<string, unknown>;
  if (
    Object.keys(d).sort().join(',') !==
    [
      'appId',
      'artifactId',
      'attempt',
      'accountId',
      'expiresAt',
      'frameCount',
      'framingVersion',
      'jobId',
      'sha256',
      'sizeBytes',
    ]
      .sort()
      .join(',')
  )
    return null;
  if (
    typeof d.artifactId !== 'string' ||
    !UUID.test(d.artifactId) ||
    typeof d.jobId !== 'string' ||
    !UUID.test(d.jobId) ||
    typeof d.accountId !== 'string' ||
    !UUID.test(d.accountId) ||
    !APPS.includes(String(d.appId)) ||
    !Number.isSafeInteger(d.attempt) ||
    Number(d.attempt) < 1 ||
    typeof d.expiresAt !== 'string' ||
    !ISO.test(d.expiresAt) ||
    !Number.isFinite(Date.parse(d.expiresAt)) ||
    !Number.isSafeInteger(d.sizeBytes) ||
    Number(d.sizeBytes) < 1 ||
    Number(d.sizeBytes) > 512 * 1024 * 1024 ||
    typeof d.sha256 !== 'string' ||
    !HASH.test(d.sha256) ||
    d.framingVersion !== 1 ||
    !Number.isSafeInteger(d.frameCount) ||
    Number(d.frameCount) !== Math.ceil(Number(d.sizeBytes) / (64 * 1024))
  )
    return null;
  return d as unknown as ArtifactDescriptor;
}
