import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthCommands,
  ProfileCommands,
  ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
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
  AccountExportOwnerEmitterError,
  ACCOUNT_EXPORT_HLS_LIMITS,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import AssetEntity from '../entities/asset.entity';
import { AssetsAccountExportMediaReader } from './account-export-media-reader';
import { AssetsAccountExportProfileSnapshotClient } from './account-export-profile-snapshot.client';

export const ASSETS_ACCOUNT_EXPORT_SOURCES =
  ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES;
export type AssetsAccountExportSource =
  (typeof ASSETS_ACCOUNT_EXPORT_SOURCES)[number];
export type AssetsAccountExportChunk =
  AccountExportOwnerChunk<AssetsAccountExportSource>;
export interface AssetsAccountExportOptions {
  grant: AccountExportCaptureGrant;
  profileSnapshot: AccountExportSnapshotDescriptor;
  onChunk: (
    chunk: AssetsAccountExportChunk,
    signal?: AbortSignal
  ) => Promise<void>;
  signal?: AbortSignal;
  captureTimeoutMs?: number;
}
export class AssetsAccountExportOwnerError extends Error {
  constructor(readonly code: AccountExportOwnerFailureCode | string) {
    super(code);
    this.name = 'AssetsAccountExportOwnerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_UUID = UUID;
const PAGE = 200;
const PAGE_PROBE = PAGE + 1;
const MEDIA_BUDGET = 128 * 1024 * 1024;
const FIELD_NAMES = new Set([
  'name',
  'type',
  'content',
  'profileId',
  'audienceCommunityIds',
  'audienceRestrictions',
  'originKind',
  'originProfileId',
  'originAppId',
  'lifecycleState',
  'lifecycleLeaseUntil',
  'lifecycleRetryAfter',
]);
const TYPES = new Set(['image', 'video', 'audio', 'document']);
const STRATEGIES = new Set([
  'local_block_storage',
  'remote_block_storage',
  'database_storage',
]);

/** Complete, read-only Assets capture tied to a leased Profile identity snapshot. */
@Injectable()
export class AssetsAccountExportOwnerService {
  private busy = false;
  private quarantined = false;
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: AssetsAccountExportProfileSnapshotClient,
    private readonly media: AssetsAccountExportMediaReader,
    private readonly authClient: ClientProxy,
    private readonly profileClient: ClientProxy
  ) {}

  async captureAccount(
    value: AssetsAccountExportOptions
  ): Promise<AssetsAccountExportChunk> {
    if (this.busy || this.quarantined)
      throw new AssetsAccountExportOwnerError('OWNER_READ_FAILED');
    if (
      !value ||
      !isAccountExportCaptureGrant(value.grant) ||
      !this.validDescriptor(value.profileSnapshot) ||
      value.profileSnapshot.accountId !== value.grant.accountId ||
      typeof value.onChunk !== 'function'
    )
      throw new AssetsAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    const onChunk = value.onChunk;
    const externalSignal = value.signal;
    const requestedTimeout = value.captureTimeoutMs;
    const grant = {
      accountId: value.grant.accountId.toLowerCase(),
      appId: value.grant.appId,
      token: value.grant.token,
      jobId: value.grant.jobId,
      attempt: value.grant.attempt,
      leaseOwner: value.grant.leaseOwner,
    };
    const descriptor = {
      handleId: value.profileSnapshot.handleId,
      participantId: value.profileSnapshot.participantId,
      accountId: value.profileSnapshot.accountId,
      captureId: value.profileSnapshot.captureId,
      snapshotAt: value.profileSnapshot.snapshotAt,
      sizeBytes: value.profileSnapshot.sizeBytes,
      sha256: value.profileSnapshot.sha256,
      rowCount: value.profileSnapshot.rowCount,
      sources: [...value.profileSnapshot.sources],
      sourceRowCounts: { ...value.profileSnapshot.sourceRowCounts },
      sourceDispositions: { ...value.profileSnapshot.sourceDispositions },
      identityCount: value.profileSnapshot.identityCount,
      expiresAt: value.profileSnapshot.expiresAt,
    };
    const timeoutMs = requestedTimeout ?? 45_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45_000)
      throw new AssetsAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    this.busy = true;
    const controller = new AbortController();
    const deadlineAt = Date.now() + timeoutMs;
    const forwardAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    let runner: QueryRunner | undefined;
    let tempTable = '';
    let transaction = false;
    let clean = true;
    let snapshotAt = '';
    let deliveryFailureCode: string | undefined;
    const accountId = grant.accountId;
    try {
      await this.validateLease(grant, controller.signal, deadlineAt);
      runner = this.dataSource.createQueryRunner();
      await runner.connect();
      this.active(controller.signal, deadlineAt);
      tempTable = `assets_export_scope_${randomUUID().replace(/-/g, '')}`;
      await runner.query(
        `CREATE TEMP TABLE "${tempTable}" ("id" uuid PRIMARY KEY) ON COMMIT PRESERVE ROWS`
      );
      await runner.startTransaction('REPEATABLE READ');
      transaction = true;
      await runner.query('SET TRANSACTION READ ONLY');
      await runner.query(`SET LOCAL statement_timeout = '10s'`);
      await runner.query(`SET LOCAL lock_timeout = '2s'`);
      const [{ snapshotAt: dbTime } = {}] = await this.query(
        runner,
        'SELECT transaction_timestamp()::text AS "snapshotAt"',
        [],
        controller.signal,
        deadlineAt
      );
      if (typeof dbTime !== 'string' || !Number.isFinite(Date.parse(dbTime)))
        throw new AssetsAccountExportOwnerError('OWNER_READ_FAILED');
      snapshotAt = dbTime;
      await this.identities.readIdentities(
        grant,
        descriptor,
        async (ids) =>
          this.insertIds(
            runner!,
            tempTable,
            ids,
            controller.signal,
            deadlineAt
          ),
        controller.signal
      );
      const emitter = new AccountExportOwnerEmitter<AssetsAccountExportSource>(
        {
          participantId: 'assets',
          accountId,
          captureId: randomUUID(),
          snapshotAt,
          sources: ASSETS_ACCOUNT_EXPORT_SOURCES,
          signal: controller.signal,
        },
        async (chunk, signal) => {
          try {
            await this.validateLease(grant, controller.signal, deadlineAt);
          } catch (error) {
            if (error instanceof AssetsAccountExportOwnerError)
              deliveryFailureCode = error.code;
            throw error;
          }
          this.active(controller.signal, deadlineAt);
          try {
            await onChunk(chunk, controller.signal);
          } catch {
            deliveryFailureCode = 'OWNER_STREAM_CONSUMER_FAILED';
            throw new AssetsAccountExportOwnerError(
              'OWNER_STREAM_CONSUMER_FAILED'
            );
          }
          this.active(controller.signal, deadlineAt);
        }
      );
      await emitter.emitSources({
        asset: () =>
          this.assets(runner!, tempTable, controller.signal, deadlineAt),
        assetMedia: () =>
          this.assetMedia(runner!, tempTable, controller.signal, deadlineAt),
        guardianActivity: () =>
          this.activities(
            runner!,
            tempTable,
            accountId,
            controller.signal,
            deadlineAt
          ),
      });
      this.active(controller.signal, deadlineAt);
      await runner.commitTransaction();
      transaction = false;
      // Drop and release precede the terminal proof. A cleanup failure quarantines this provider.
      try {
        await runner.query(`DROP TABLE IF EXISTS "${tempTable}"`);
      } catch (error) {
        clean = false;
        throw error;
      }
      tempTable = '';
      try {
        await runner.release();
      } catch (error) {
        clean = false;
        throw error;
      }
      runner = undefined;
      await this.validateLease(grant, controller.signal, deadlineAt);
      this.active(controller.signal, deadlineAt);
      return await emitter.complete();
    } catch (error) {
      if (controller.signal.aborted)
        throw new AssetsAccountExportOwnerError(
          externalSignal?.aborted
            ? 'OWNER_CAPTURE_ABORTED'
            : 'OWNER_CAPTURE_TIMEOUT'
        );
      if (error instanceof AssetsAccountExportOwnerError) throw error;
      if (
        error instanceof AccountExportOwnerEmitterError &&
        error.code === 'OWNER_STREAM_CONSUMER_FAILED'
      )
        throw new AssetsAccountExportOwnerError(
          deliveryFailureCode ?? 'OWNER_STREAM_CONSUMER_FAILED'
        );
      throw new AssetsAccountExportOwnerError('OWNER_READ_FAILED');
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', forwardAbort);
      if (runner) {
        try {
          if (transaction) await runner.rollbackTransaction();
        } catch {
          clean = false;
        }
        try {
          if (tempTable)
            await runner.query(`DROP TABLE IF EXISTS "${tempTable}"`);
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
          const evict = (
            runner as unknown as {
              releasePostgresConnection?: (error: Error) => Promise<void>;
            }
          ).releasePostgresConnection;
          if (typeof evict === 'function') {
            try {
              await evict.call(
                runner,
                new Error('ASSETS_ACCOUNT_EXPORT_CLEANUP_FAILED')
              );
              runner = undefined;
            } catch {
              // Keep the failed runner out of the pool; restart clears quarantine.
            }
          }
        }
      }
      if (!clean) this.quarantined = true;
      this.busy = false;
    }
  }

  private async *assets(
    r: QueryRunner,
    temp: string,
    signal: AbortSignal,
    deadline: number
  ): AsyncIterable<AccountExportOwnerRecord<AssetsAccountExportSource>> {
    let cursor: string | null = null;
    while (true) {
      const rows = await this.query(
        r,
        `SELECT a."id"::text AS "id", left(a."profileId",37) AS "profileId", char_length(a."profileId") AS "profileIdLength", left(a."name",1025) AS "name", char_length(a."name") AS "nameLength", a."type", a."storageStrategy", left(a."storagePath",4097) AS "storagePath", char_length(a."storagePath") AS "pathLength", a."originKind", a."originProfileId"::text AS "originProfileId", left(a."originAppId",121) AS "originAppId", char_length(a."originAppId") AS "originAppIdLength", a."lifecycleState" FROM "asset_entity" a JOIN "${temp}" s ON s."id"::text=lower(a."profileId") WHERE ($1::uuid IS NULL OR a."id">$1::uuid) ORDER BY a."id" LIMIT $2`,
        [cursor, PAGE_PROBE],
        signal,
        deadline
      );
      if (!rows.length) break;
      for (const raw of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        const x = raw as Record<string, unknown>;
        const row = this.validateAsset(x);
        if (!(await this.scopeHas(r, temp, row.profileId, signal, deadline)))
          throw new AssetsAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        yield {
          source: 'asset',
          data: {
            id: row.id,
            profileId: row.profileId,
            name: row.name,
            type: row.type,
            origin: row.origin,
          },
        };
        cursor = row.id;
      }
      if (rows.length <= PAGE) break;
    }
  }

  private async *assetMedia(
    r: QueryRunner,
    temp: string,
    signal: AbortSignal,
    deadline: number
  ): AsyncIterable<AccountExportOwnerRecord<AssetsAccountExportSource>> {
    let profile: string | null = null;
    let assetId: string | null = null;
    const budget = { remainingBytes: MEDIA_BUDGET };
    while (true) {
      const rows = await this.query(
        r,
        `SELECT a."id"::text AS "id", left(a."profileId",37) AS "profileId", char_length(a."profileId") AS "profileIdLength", left(a."name",1025) AS "name", char_length(a."name") AS "nameLength", a."type", a."storageStrategy", left(a."storagePath",4097) AS "storagePath", char_length(a."storagePath") AS "pathLength", a."originKind", a."originProfileId"::text AS "originProfileId", left(a."originAppId",121) AS "originAppId", char_length(a."originAppId") AS "originAppIdLength", a."lifecycleState" FROM "asset_entity" a JOIN "${temp}" s ON s."id"::text=lower(a."profileId") WHERE ($1::varchar IS NULL OR (lower(a."profileId"),a."id")>(lower($1::varchar),$2::uuid)) ORDER BY lower(a."profileId"),a."id" LIMIT $3`,
        [profile, assetId, PAGE_PROBE],
        signal,
        deadline
      );
      if (!rows.length) break;
      for (const raw of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        const row = this.validateAsset(raw as Record<string, unknown>);
        if (!(await this.scopeHas(r, temp, row.profileId, signal, deadline)))
          throw new AssetsAccountExportOwnerError(
            'OWNER_RELATIONSHIP_AMBIGUOUS'
          );
        const entity = Object.assign(new AssetEntity(), {
          ...row,
          storagePath: (raw as any).storagePath,
          storageStrategy: (raw as any).storageStrategy,
        });
        for await (const record of this.media.read(entity, {
          signal,
          budget,
          validateHlsReferences: (ids) =>
            this.validateHlsReferences(r, temp, ids, signal, deadline),
        }))
          yield record as AccountExportOwnerRecord<AssetsAccountExportSource>;
        profile = row.profileId;
        assetId = row.id;
      }
      if (rows.length <= PAGE) break;
    }
  }

  private async validateHlsReferences(
    r: QueryRunner,
    temp: string,
    ids: readonly string[],
    signal: AbortSignal,
    deadline: number
  ): Promise<void> {
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > ACCOUNT_EXPORT_HLS_LIMITS.references ||
      ids.some((id) => typeof id !== 'string' || !SAFE_UUID.test(id))
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    const normalized = ids.map((id) => id.toLowerCase());
    if (new Set(normalized).size !== normalized.length)
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    for (let offset = 0; offset < normalized.length; offset += PAGE) {
      this.active(signal, deadline);
      const batch = normalized.slice(offset, offset + PAGE);
      const rows = await this.query(
        r,
        `SELECT a.id::text AS id FROM asset_entity a JOIN "${temp}" s ON s.id::text=lower(a."profileId") WHERE a.id=ANY($1::uuid[]) AND a.type='video' AND a."lifecycleState"='active' AND a."storageStrategy" IN ('local_block_storage','remote_block_storage')`,
        [batch],
        signal,
        deadline
      );
      if (
        rows.length !== batch.length ||
        rows.some(
          (row) => typeof row.id !== 'string' || !batch.includes(row.id)
        )
      )
        throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    }
  }

  private async *activities(
    r: QueryRunner,
    temp: string,
    account: string,
    signal: AbortSignal,
    deadline: number
  ): AsyncIterable<AccountExportOwnerRecord<AssetsAccountExportSource>> {
    let cursor: string | null = null;
    while (true) {
      const rows = await this.query(
        r,
        `SELECT left(ga."id"::text,37) AS "id", left(ga."actorUserId",37) AS "actorUserId", char_length(ga."actorUserId") AS "actorLength", left(ga."dependentUserId",37) AS "dependentUserId", char_length(ga."dependentUserId") AS "dependentLength", left(ga."profileId",37) AS "profileId", char_length(ga."profileId") AS "profileLength", left(ga."assetId",37) AS "assetId", char_length(ga."assetId") AS "assetLength", left(ga."appId",121) AS "appId", char_length(ga."appId") AS "appLength", left(ga."operation",65) AS "operation", char_length(ga."operation") AS "operationLength", left(ga."changedFieldNames"::text,8193) AS "changedFieldNames", char_length(ga."changedFieldNames"::text) AS "fieldsLength", to_char(ga."createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt" FROM "guardian_asset_activity" ga WHERE (lower(ga."actorUserId")=$1 OR lower(ga."dependentUserId")=$1) AND ($2::uuid IS NULL OR ga."id">$2::uuid) ORDER BY ga."id" LIMIT $3`,
        [account, cursor, PAGE_PROBE],
        signal,
        deadline
      );
      if (!rows.length) break;
      for (const raw of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        const x = raw as Record<string, unknown>;
        const row = await this.validateActivity(
          x,
          temp,
          account,
          r,
          signal,
          deadline
        );
        yield { source: 'guardianActivity', data: row.data };
        cursor = String(x.id);
      }
      if (rows.length <= PAGE) break;
    }
  }

  private async validateActivity(
    x: Record<string, unknown>,
    temp: string,
    account: string,
    r: QueryRunner,
    signal: AbortSignal,
    deadline: number
  ): Promise<{ data: Record<string, unknown> }> {
    const id = this.uuid(x.id),
      actor = this.uuid(x.actorUserId),
      dependent = this.uuid(x.dependentUserId),
      profileId = this.uuid(x.profileId);
    if (
      !UUID.test(id) ||
      !UUID.test(actor) ||
      !UUID.test(dependent) ||
      !UUID.test(profileId) ||
      Number(x.actorLength) > 36 ||
      Number(x.dependentLength) > 36 ||
      Number(x.profileLength) > 36 ||
      (Number(x.assetLength) > 36 && x.assetId !== '*') ||
      Number(x.appLength) > 120 ||
      Number(x.operationLength) > 64 ||
      (actor !== account && dependent !== account) ||
      !this.validApp(x.appId) ||
      !['upload', 'list', 'read', 'delete'].includes(String(x.operation)) ||
      Number(x.fieldsLength) > 8192 ||
      typeof x.changedFieldNames !== 'string' ||
      typeof x.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(x.createdAt))
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    let fields: unknown;
    try {
      fields = JSON.parse(x.changedFieldNames);
    } catch {
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    }
    if (
      !Array.isArray(fields) ||
      fields.length > 64 ||
      fields.some((f) => typeof f !== 'string' || !FIELD_NAMES.has(f))
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    const profile = await this.profileLookup(profileId, signal, deadline);
    if (profile.userId !== dependent)
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    const owned = dependent === account;
    if (owned && !(await this.scopeHas(r, temp, profileId, signal, deadline)))
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    const assetId = String(x.assetId ?? '');
    if (x.operation === 'list') {
      if (assetId !== '*')
        throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    } else {
      if (!SAFE_UUID.test(assetId))
        throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
      const assets = await this.query(
        r,
        `SELECT lower("profileId") AS "profileId" FROM "asset_entity" WHERE "id"=$1::uuid`,
        [assetId],
        signal,
        deadline
      );
      if (assets.length && assets[0].profileId !== profileId)
        throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    }
    return {
      data: {
        id,
        accountRoles: [
          ...(actor === account ? ['actor'] : []),
          ...(dependent === account ? ['dependent'] : []),
        ],
        actorRole: actor === account ? 'account' : 'counterpart',
        dependentRole: dependent === account ? 'account' : 'counterpart',
        ownedProfileId: owned ? profileId : null,
        assetReference: owned ? assetId : 'counterpart-asset',
        appId: x.appId,
        operation: x.operation,
        changedFieldNames: fields,
        createdAt: x.createdAt,
      },
    };
  }

  private validateAsset(x: Record<string, unknown>) {
    const id = this.uuid(x.id),
      profileId = this.uuid(x.profileId),
      name = x.name;
    if (
      !SAFE_UUID.test(id) ||
      !SAFE_UUID.test(profileId) ||
      Number(x.profileIdLength) > 36 ||
      typeof name !== 'string' ||
      Number(x.nameLength) > 1024 ||
      name.length > 1024 ||
      /[\\/]/.test(name) ||
      hasControlCharacters(name) ||
      !TYPES.has(String(x.type)) ||
      !STRATEGIES.has(String(x.storageStrategy)) ||
      typeof x.storagePath !== 'string' ||
      Number(x.pathLength) > 4096 ||
      x.storagePath.length > 4096 ||
      !['ordinary', 'guardian-staged'].includes(String(x.originKind)) ||
      !['active'].includes(String(x.lifecycleState)) ||
      Number(x.originAppIdLength) > 120
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    if (
      x.originKind === 'ordinary' &&
      (x.originProfileId != null || x.originAppId != null)
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    if (
      x.originKind === 'guardian-staged' &&
      (x.originProfileId !== profileId || !this.validApp(x.originAppId))
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    return {
      id,
      profileId,
      name,
      type: x.type,
      origin: {
        kind: x.originKind,
        profileId:
          x.originKind === 'guardian-staged' ? x.originProfileId : null,
        appId: x.originKind === 'guardian-staged' ? x.originAppId : null,
      },
    };
  }

  private async insertIds(
    r: QueryRunner,
    temp: string,
    ids: readonly string[],
    signal: AbortSignal,
    deadline: number
  ) {
    this.active(signal, deadline);
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((x) => !SAFE_UUID.test(x))
    )
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    if (ids.length)
      await this.query(
        r,
        `INSERT INTO "${temp}" ("id") SELECT unnest($1::uuid[])`,
        [ids],
        signal,
        deadline
      );
  }
  private async scopeHas(
    r: QueryRunner,
    temp: string,
    id: string,
    signal: AbortSignal,
    deadline: number
  ) {
    return (
      (
        await this.query(
          r,
          `SELECT 1 FROM "${temp}" WHERE "id"=$1::uuid`,
          [id],
          signal,
          deadline
        )
      ).length === 1
    );
  }
  private async query(
    r: QueryRunner,
    sql: string,
    params: unknown[],
    signal: AbortSignal,
    deadline: number
  ): Promise<any[]> {
    this.active(signal, deadline);
    const result = await r.query(sql, params);
    this.active(signal, deadline);
    if (!Array.isArray(result))
      throw new AssetsAccountExportOwnerError('OWNER_READ_FAILED');
    return result;
  }
  private async validateLease(
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
    } catch (error) {
      if (error instanceof AssetsAccountExportOwnerError) throw error;
      throw new AssetsAccountExportOwnerError('OWNER_AUTHORIZATION_FAILED');
    }
  }
  private async profileLookup(
    profileId: string,
    signal: AbortSignal,
    deadline: number
  ) {
    this.active(signal, deadline);
    try {
      const value = await firstValueFrom(
        this.profileClient
          .send({ cmd: ProfileCommands.Get }, { id: profileId })
          .pipe(timeout(3000))
      );
      this.active(signal, deadline);
      const p = value?.data ?? value;
      if (
        !p ||
        typeof p.id !== 'string' ||
        p.id.toLowerCase() !== profileId.toLowerCase() ||
        typeof p.userId !== 'string' ||
        !SAFE_UUID.test(p.userId)
      )
        throw new Error();
      return { userId: p.userId.toLowerCase() };
    } catch (error) {
      if (error instanceof AssetsAccountExportOwnerError) throw error;
      throw new AssetsAccountExportOwnerError('OWNER_RELATIONSHIP_AMBIGUOUS');
    }
  }
  private validApp(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value)
    );
  }
  private active(signal: AbortSignal, deadline: number) {
    if (signal.aborted)
      throw new AssetsAccountExportOwnerError(
        Date.now() >= deadline
          ? 'OWNER_CAPTURE_TIMEOUT'
          : 'OWNER_CAPTURE_ABORTED'
      );
    if (Date.now() >= deadline)
      throw new AssetsAccountExportOwnerError('OWNER_CAPTURE_TIMEOUT');
  }
  private uuid(v: unknown) {
    return typeof v === 'string' ? v.toLowerCase() : '';
  }
  private validDescriptor(v: unknown): v is AccountExportSnapshotDescriptor {
    if (!v || typeof v !== 'object') return false;
    const d = v as AccountExportSnapshotDescriptor;
    return (
      d.participantId === 'profile' &&
      typeof d.accountId === 'string' &&
      UUID.test(d.accountId) &&
      typeof d.captureId === 'string' &&
      UUID.test(d.captureId) &&
      typeof d.handleId === 'string' &&
      UUID.test(d.handleId) &&
      Array.isArray(d.sources) &&
      this.isRecord(d.sourceRowCounts) &&
      this.isRecord(d.sourceDispositions) &&
      Number.isSafeInteger(d.sizeBytes) &&
      d.sizeBytes >= 0 &&
      Number.isSafeInteger(d.rowCount) &&
      d.rowCount >= 0 &&
      typeof d.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(d.sha256) &&
      Number.isSafeInteger(d.identityCount) &&
      d.identityCount >= 0 &&
      d.identityCount <=
        ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize *
          ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPages &&
      typeof d.snapshotAt === 'string' &&
      d.snapshotAt.length <= 128 &&
      Number.isFinite(Date.parse(d.snapshotAt)) &&
      typeof d.expiresAt === 'string' &&
      Number.isFinite(Date.parse(d.expiresAt))
    );
  }
  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
