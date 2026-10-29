import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AccountExportArtifactBuilderService,
  AccountExportArtifactHandle,
  AccountExportArtifactStoreService,
  ArtifactDescriptor,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY } from './account-export-release-registry';
import { AccountExportJobEntity } from './entities/account-export-job.entity';

const FRAME_BYTES = 64 * 1024;
const DEFAULT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_QUOTA = 2;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

@Injectable()
export class AccountExportArtifactService {
  constructor(
    @Inject(getRepositoryToken(AccountExportJobEntity))
    private readonly jobs: Repository<AccountExportJobEntity>,
    private readonly builder: AccountExportArtifactBuilderService,
    private readonly store: AccountExportArtifactStoreService
  ) {}

  async prepare(input: {
    claim: AccountExportJobEntity;
    handles: readonly OwnerSpoolHandle<string>[];
    summary: Record<string, unknown>;
    renewLease: () => Promise<boolean>;
    signal?: AbortSignal;
  }): Promise<{
    descriptor: ArtifactDescriptor;
    summary: Record<string, unknown>;
  }> {
    const { claim, handles, summary, renewLease, signal } = input;
    assertClaim(claim);
    let built: AccountExportArtifactHandle | undefined;
    let descriptor: ArtifactDescriptor | undefined;
    let failure: unknown;
    try {
      await this.requireCurrent(renewLease);
      await this.enforceQuota(claim);
      built = await this.builder.build({
        appId: claim.appId,
        accountId: claim.accountId,
        owners: handles,
        expectedSourcesByOwner: ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY,
        signal,
      });
      await this.requireCurrent(renewLease);
      descriptor = Object.freeze({
        artifactId: randomUUID(),
        jobId: claim.id,
        accountId: claim.accountId,
        appId: claim.appId,
        attempt: claim.attempt,
        expiresAt: new Date(Date.now() + DEFAULT_LIFETIME_MS).toISOString(),
        sizeBytes: built.metadata.sizeBytes,
        sha256: built.metadata.sha256,
        frameCount: Math.ceil(built.metadata.sizeBytes / FRAME_BYTES),
        framingVersion: 1,
      });
      const intentSummary = {
        ...summary,
        privateArtifact: descriptor,
        artifactState: 'assembling',
        artifactAvailable: false,
      };
      if ((await this.writeSummary(claim, intentSummary)) !== 1)
        throw new Error('ARTIFACT_LEASE_LOST');
      await this.requireCurrent(renewLease);
      const stored = await this.store.put({
        ...descriptor,
        stream: built.createReadStream(),
        signal,
        assertCurrent: renewLease,
        withCurrentLease: async (commit) => {
          await this.jobs.manager.transaction(async (manager) => {
            const rows = await manager.query(
              `SELECT "id" FROM "account_export_jobs" WHERE "id"=$1::uuid AND "accountId"=$2::uuid
              AND "appId"=$3 AND "attempt"=$4 AND "leaseOwner"=$5 AND "state"='running'
              AND "leaseExpiresAt">clock_timestamp() AND "coverageSummary"->'privateArtifact'=$6::jsonb FOR UPDATE`,
              [
                claim.id,
                claim.accountId,
                claim.appId,
                claim.attempt,
                claim.leaseOwner,
                JSON.stringify(descriptor),
              ]
            );
            if (rows.length !== 1) throw new Error('ARTIFACT_LEASE_LOST');
            await commit();
          });
        },
      });
      if (!sameDescriptor(stored, descriptor))
        throw new Error('ARTIFACT_DESCRIPTOR_MISMATCH');
      await this.requireCurrent(renewLease);
      const staged = built;
      await staged.cleanup();
      built = undefined;
      return {
        descriptor,
        summary: {
          ...summary,
          privateArtifact: descriptor,
          artifactState: 'verified',
          artifactAvailable: false,
        },
      };
    } catch (error) {
      failure = error;
      let erased = false;
      if (descriptor) {
        try {
          await this.store.remove(descriptor, () =>
            this.ownsIntent(claim, descriptor!)
          );
          erased = true;
        } catch (cleanupError) {
          failure = cleanupFailure(error, cleanupError);
        }
      }
      if (descriptor && erased) {
        try {
          await this.clearIntent(claim, descriptor);
        } catch (cleanupError) {
          failure = cleanupFailure(failure, cleanupError);
        }
      }
      if (built) {
        try {
          await built.cleanup();
        } catch (error) {
          failure = cleanupFailure(failure, error);
        }
      }
      throw failure;
    }
  }

  async recover(
    claim: AccountExportJobEntity,
    renewLease: () => Promise<boolean>
  ): Promise<void> {
    assertClaim(claim);
    const old = readDescriptor(claim.coverageSummary?.privateArtifact);
    if (!old) return;
    assertSameJob(old, claim);
    if (old.attempt > claim.attempt)
      throw new Error('ARTIFACT_CONTEXT_MISMATCH');
    await this.requireCurrent(renewLease);
    await this.store.remove(old, () => this.ownsIntent(claim, old));
    const result = await this.clearIntent(claim, old);
    if (result !== 1) throw new Error('ARTIFACT_LEASE_LOST');
  }

  async discard(
    claim: AccountExportJobEntity,
    descriptor: ArtifactDescriptor
  ): Promise<void> {
    assertClaim(claim);
    assertSameJob(descriptor, claim);
    if (descriptor.attempt !== claim.attempt)
      throw new Error('ARTIFACT_CONTEXT_MISMATCH');
    await this.store.remove(descriptor, () =>
      this.ownsIntent(claim, descriptor!)
    );
    await this.clearIntent(claim, descriptor);
  }

  private async ownsIntent(
    claim: AccountExportJobEntity,
    descriptor: ArtifactDescriptor
  ): Promise<boolean> {
    const row = await this.jobs.findOneBy({
      id: claim.id,
      accountId: claim.accountId,
      appId: claim.appId,
    });
    return (
      !!row &&
      descriptor.attempt <= row.attempt &&
      sameDescriptor(row.coverageSummary?.privateArtifact, descriptor)
    );
  }

  private async enforceQuota(claim: AccountExportJobEntity): Promise<void> {
    const rows: Array<{ count: string | number }> = await this.jobs.query(
      `SELECT count(*)::int AS count
       FROM "account_export_jobs"
       WHERE "accountId"=$1::uuid AND "id"<>$2::uuid
         AND "coverageSummary" ? 'privateArtifact'
         AND "coverageSummary"->>'artifactState' IN ('assembling','verified','cleanup-pending')
         AND CASE WHEN "coverageSummary"->'privateArtifact'->>'expiresAt' ~ $3
           THEN ("coverageSummary"->'privateArtifact'->>'expiresAt')::timestamptz > clock_timestamp()
           ELSE true END`,
      [
        claim.accountId,
        claim.id,
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$',
      ]
    );
    if (
      !Number.isSafeInteger(Number(rows?.[0]?.count)) ||
      Number(rows?.[0]?.count) < 0
    )
      throw new Error('ARTIFACT_QUOTA_READ_FAILED');
    if (Number(rows?.[0]?.count) >= ACCOUNT_QUOTA)
      throw new Error('ARTIFACT_ACCOUNT_QUOTA_EXCEEDED');
  }

  private async writeSummary(
    claim: AccountExportJobEntity,
    summary: Record<string, unknown>
  ): Promise<number> {
    const result = await this.jobs
      .createQueryBuilder()
      .update(AccountExportJobEntity)
      .set({ coverageSummary: summary })
      .where(
        '"id" = :id AND "accountId" = :accountId AND "appId" = :appId AND "attempt" = :attempt AND "leaseOwner" = :leaseOwner AND "state" = :state AND "leaseExpiresAt" > clock_timestamp()',
        {
          id: claim.id,
          accountId: claim.accountId,
          appId: claim.appId,
          attempt: claim.attempt,
          leaseOwner: claim.leaseOwner,
          state: 'running',
        }
      )
      .execute();
    return result.affected ?? 0;
  }

  private async clearIntent(
    claim: AccountExportJobEntity,
    descriptor: ArtifactDescriptor
  ): Promise<number> {
    const result = await this.jobs
      .createQueryBuilder()
      .update(AccountExportJobEntity)
      .set({
        coverageSummary: () =>
          `jsonb_set(jsonb_set(jsonb_set("coverageSummary", '{privateArtifact}', 'null'::jsonb, false), '{artifactState}', 'null'::jsonb, false), '{artifactAvailable}', 'null'::jsonb, false) - 'privateArtifact' - 'artifactState' - 'artifactAvailable'`,
      })
      .where(
        `"id" = :id AND "accountId" = :accountId AND "appId" = :appId AND "attempt" = :attempt AND "leaseOwner" = :leaseOwner AND "state" = 'running' AND "leaseExpiresAt" > clock_timestamp() AND "coverageSummary"->'privateArtifact' = :descriptor::jsonb`,
        {
          id: claim.id,
          accountId: claim.accountId,
          appId: claim.appId,
          attempt: claim.attempt,
          leaseOwner: claim.leaseOwner,
          descriptor: JSON.stringify(descriptor),
        }
      )
      .execute();
    return result.affected ?? 0;
  }

  private async requireCurrent(
    renewLease: () => Promise<boolean>
  ): Promise<void> {
    if (!(await renewLease())) throw new Error('ARTIFACT_LEASE_LOST');
  }
}

function assertClaim(claim: AccountExportJobEntity): void {
  if (
    !claim ||
    !isUuid(claim.id) ||
    !isUuid(claim.accountId) ||
    !isUuid(claim.leaseOwner) ||
    typeof claim.appId !== 'string' ||
    !['client-interface', 'local-hub'].includes(claim.appId) ||
    !Number.isSafeInteger(claim.attempt) ||
    claim.attempt < 1
  )
    throw new Error('ARTIFACT_CLAIM_INVALID');
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function readDescriptor(value: unknown): ArtifactDescriptor | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value))
    throw new Error('ARTIFACT_CONTEXT_MISMATCH');
  const d = value as ArtifactDescriptor;
  if (
    !isUuid(d.artifactId) ||
    !isUuid(d.jobId) ||
    !isUuid(d.accountId) ||
    typeof d.appId !== 'string' ||
    !['client-interface', 'local-hub'].includes(d.appId) ||
    !Number.isSafeInteger(d.attempt) ||
    d.attempt < 1 ||
    !ISO_DATE.test(d.expiresAt) ||
    !Number.isFinite(Date.parse(d.expiresAt)) ||
    new Date(d.expiresAt).toISOString() !== d.expiresAt ||
    !Number.isSafeInteger(d.sizeBytes) ||
    d.sizeBytes < 1 ||
    !/^[0-9a-f]{64}$/i.test(d.sha256) ||
    !Number.isSafeInteger(d.frameCount) ||
    d.frameCount !== Math.ceil(d.sizeBytes / FRAME_BYTES) ||
    d.framingVersion !== 1
  )
    throw new Error('ARTIFACT_CONTEXT_MISMATCH');
  return d;
}

function assertSameJob(
  d: ArtifactDescriptor,
  claim: AccountExportJobEntity
): void {
  if (
    !sameDescriptor(readDescriptor(d), d) ||
    d.jobId !== claim.id ||
    d.accountId !== claim.accountId ||
    d.appId !== claim.appId
  )
    throw new Error('ARTIFACT_CONTEXT_MISMATCH');
}

function sameDescriptor(a: unknown, b: ArtifactDescriptor): boolean {
  if (!a || typeof a !== 'object') return false;
  const x = a as ArtifactDescriptor;
  return (
    x.artifactId === b.artifactId &&
    x.jobId === b.jobId &&
    x.accountId === b.accountId &&
    x.appId === b.appId &&
    x.attempt === b.attempt &&
    x.expiresAt === b.expiresAt &&
    x.sizeBytes === b.sizeBytes &&
    x.sha256 === b.sha256 &&
    x.frameCount === b.frameCount &&
    x.framingVersion === b.framingVersion
  );
}

function cleanupFailure(original: unknown, cleanup: unknown): Error {
  const error = new Error('ARTIFACT_CLEANUP_FAILED');
  (error as Error & { cause?: unknown }).cause = { original, cleanup };
  return error;
}
