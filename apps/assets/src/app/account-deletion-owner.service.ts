import { Inject, Injectable } from '@nestjs/common';
import {
  AccountDeletionAction,
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
  AssetDto,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  DeletionIdentity,
  installDeletionWriteFence,
  STORAGE_ADAPTERS,
  StorageAdapter,
  VerifiedMediaSpoolService,
} from '@optimistic-tanuki/storage';
import { DataSource, QueryRunner } from 'typeorm';
import { assetMediaReadLockKey } from './asset-media-read-fence.service';
import { AssetsAuditErasureService } from './audit-erasure.service';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PAGE = 25;
const LIMIT = 10_000;
const PROFILE_LIMIT = 1_000;
type Row = Record<string, unknown>;

export class AssetsAccountDeletionOwnerError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'AssetsAccountDeletionOwnerError';
  }
}

@Injectable()
export class AssetsAccountDeletionOwnerService {
  constructor(
    @Inject('ASSETS_CONNECTION') private readonly dataSource: DataSource,
    private readonly authority: AccountDeletionAuthorityClient,
    @Inject(STORAGE_ADAPTERS) private readonly adapter: StorageAdapter,
    private readonly audit: AssetsAuditErasureService,
    private readonly mediaSpool: VerifiedMediaSpoolService
  ) {}

  async execute(value: unknown, action: AccountDeletionAction) {
    if (!['fence', 'erase', 'readback'].includes(action))
      throw new AssetsAccountDeletionOwnerError('ACTION_INVALID');
    if (!validateDeletionGrantShape(value))
      throw new AssetsAccountDeletionOwnerError('GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    if (grant.owner !== 'assets' || grant.action !== action)
      throw new AssetsAccountDeletionOwnerError('GRANT_INVALID');
    const verified = await this.authority.validate(grant, 'assets', action);
    const accountId = verified.accountId;
    if (!UUID.test(accountId) || accountId !== accountId.toLowerCase())
      throw new AssetsAccountDeletionOwnerError('ACCOUNT_INVALID');
    const scope = verified.scope;
    if (!scope || !validateDeletionIdentityDomains(scope))
      throw new AssetsAccountDeletionOwnerError('SCOPE_REQUIRED');
    if (
      scope.currentProfileIds.length > PROFILE_LIMIT ||
      scope.currentProfileIds.length + 1 > PROFILE_LIMIT
    )
      throw new AssetsAccountDeletionOwnerError('SCOPE_BOUND_EXCEEDED');
    if (scope.legacyProfileIds.length)
      throw new AssetsAccountDeletionOwnerError(
        'LEGACY_PROFILE_CATALOG_UNAVAILABLE'
      );
    await this.mediaSpool.assertDeletionReady();
    if (action === 'fence') await this.fence(grant, accountId, scope);
    else if (action === 'erase') await this.erase(grant, accountId, scope);
    else await this.readback(grant, accountId, scope);
    return { fenced: true, profileCount: scope.currentProfileIds.length };
  }

  private async fence(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains
  ) {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      await this.budgets(runner);
      await this.fresh(grant, 'fence', scope);
      const profiles = [...scope.currentProfileIds].sort();
      await this.install(runner, grant.operationId, accountId, profiles);
      await this.assertAssetBindings(runner, scope);
      let cursor = '';
      let total = 0;
      while (true) {
        const rows = await this.rows(
          runner,
          `SELECT "id" FROM "asset_entity" WHERE lower("profileId"::text)=ANY($1::text[]) AND "id"::text > $2 ORDER BY "id" LIMIT ${PAGE} FOR UPDATE`,
          [profiles, cursor]
        );
        if (!Array.isArray(rows) || rows.length > PAGE)
          this.fail('ASSET_SCAN_INVALID');
        if (!rows.length) break;
        total += rows.length;
        if (total > LIMIT) this.fail('ASSET_LIMIT_EXCEEDED');
        const ids = rows.map((r) => this.uuid(r['id']));
        if (ids.some((id) => !id)) this.fail('ASSET_ID_INVALID');
        cursor = ids[ids.length - 1];
        await runner.query(
          `UPDATE "asset_entity" SET "lifecycleState"='pending-delete', "lifecycleLeaseUntil"=NULL, "lifecycleRetryAfter"=NULL WHERE "id" = ANY($1::uuid[])`,
          [ids]
        );
      }
      await runner.commitTransaction();
    } catch (e) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  private async erase(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains
  ) {
    let total = 0;
    while (true) {
      await this.fresh(grant, 'erase', scope);
      const idsRunner = this.dataSource.createQueryRunner();
      let ids: string[];
      try {
        await idsRunner.connect();
        await idsRunner.startTransaction();
        await this.budgets(idsRunner);
        await this.install(
          idsRunner,
          grant.operationId,
          accountId,
          [...scope.currentProfileIds].sort()
        );
        await this.assertAssetBindings(idsRunner, scope);
        const rows = await this.rows(
          idsRunner,
          `SELECT "id" FROM "asset_entity" WHERE lower("profileId"::text)=ANY($1::text[]) AND "lifecycleState"='pending-delete' ORDER BY "id" LIMIT ${PAGE} FOR UPDATE SKIP LOCKED`,
          [[...scope.currentProfileIds]]
        );
        if (!Array.isArray(rows) || rows.length > PAGE)
          this.fail('ASSET_SCAN_INVALID');
        ids = rows.map((r) => this.uuid(r['id']));
        if (ids.some((id) => !id)) this.fail('ASSET_ID_INVALID');
        if (!ids.length) {
          await idsRunner.commitTransaction();
          break;
        }
        total += ids.length;
        if (total > LIMIT) this.fail('ASSET_LIMIT_EXCEEDED');
        await idsRunner.commitTransaction();
      } catch (e) {
        if (idsRunner.isTransactionActive)
          await idsRunner.rollbackTransaction();
        throw e;
      } finally {
        await idsRunner.release();
      }
      for (const id of ids!) await this.purgeOne(grant, accountId, scope, id);
    }
    await this.fresh(grant, 'erase', scope);
    const remainingRunner = this.dataSource.createQueryRunner();
    try {
      await remainingRunner.connect();
      const rows = await remainingRunner.query(
        'SELECT count(*)::int AS count FROM "asset_entity" WHERE lower("profileId"::text)=ANY($1::text[]) OR lower("originProfileId"::text)=ANY($1::text[])',
        [[...scope.currentProfileIds]]
      );
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        this.count(rows[0]?.count) !== 0
      )
        this.fail('READBACK_INCOMPLETE');
    } finally {
      await remainingRunner.release();
    }
    const receipt = (await this.audit.eraseParticipation(
      { accountId, profileIds: [...scope.currentProfileIds] } as never,
      grant.operationId
    )) as { allDeclaredSourcesVerified?: boolean };
    if (receipt?.allDeclaredSourcesVerified !== true)
      this.fail('AUDIT_ERASURE_INCOMPLETE');
    await this.readback(grant, accountId, scope, 'erase');
  }

  private async purgeOne(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains,
    id: string
  ) {
    const readRunner = this.dataSource.createQueryRunner();
    let dto: AssetDto;
    try {
      await readRunner.connect();
      await readRunner.startTransaction();
      await this.budgets(readRunner);
      await this.fresh(grant, 'erase', scope);
      await this.install(
        readRunner,
        grant.operationId,
        accountId,
        [...scope.currentProfileIds].sort()
      );
      const rows = await this.rows(
        readRunner,
        'SELECT * FROM "asset_entity" WHERE "id"=$1::uuid FOR UPDATE',
        [id]
      );
      if (!Array.isArray(rows) || rows.length !== 1) this.fail('ASSET_CHANGED');
      const row = rows[0];
      this.validateBinding(row, scope);
      dto = this.dto(row);
      await readRunner.commitTransaction();
    } catch (e) {
      if (readRunner.isTransactionActive)
        await readRunner.rollbackTransaction();
      throw e;
    } finally {
      await readRunner.release();
    }

    const adapter = this.adapter;
    if (typeof adapter?.purgeOwnedAsset !== 'function')
      this.fail('STORAGE_PURGE_UNSUPPORTED');
    try {
      await this.fresh(grant, 'erase', scope);
      const result = await adapter.purgeOwnedAsset(dto!);
      if (result?.verifiedAbsent !== true)
        this.fail('STORAGE_ABSENCE_UNVERIFIED');
    } catch (e) {
      await this.markPending(grant, accountId, scope, id);
      throw e instanceof AssetsAccountDeletionOwnerError
        ? e
        : new AssetsAccountDeletionOwnerError('STORAGE_PURGE_FAILED');
    }

    const deleteRunner = this.dataSource.createQueryRunner();
    try {
      await deleteRunner.connect();
      await deleteRunner.startTransaction();
      await this.budgets(deleteRunner);
      await this.fresh(grant, 'erase', scope);
      await this.install(
        deleteRunner,
        grant.operationId,
        accountId,
        [...scope.currentProfileIds].sort()
      );
      const rows = await this.rows(
        deleteRunner,
        'SELECT * FROM "asset_entity" WHERE "id"=$1::uuid FOR UPDATE',
        [id]
      );
      if (rows.length !== 1) this.fail('ASSET_CHANGED');
      this.validateBinding(rows[0], scope);
      await deleteRunner.query(
        'DELETE FROM "asset_entity" WHERE "id"=$1::uuid',
        [id]
      );
      await deleteRunner.commitTransaction();
    } catch (e) {
      if (deleteRunner.isTransactionActive)
        await deleteRunner.rollbackTransaction();
      throw e;
    } finally {
      await deleteRunner.release();
    }
  }

  private async markPending(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains,
    id: string
  ) {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      await this.budgets(runner);
      await this.fresh(grant, 'erase', scope);
      await this.install(
        runner,
        grant.operationId,
        accountId,
        [...scope.currentProfileIds].sort()
      );
      await runner.query(
        `UPDATE "asset_entity" SET "lifecycleState"='pending-delete', "lifecycleLeaseUntil"=NULL, "lifecycleRetryAfter"=now()+interval '1 minute' WHERE "id"=$1::uuid`,
        [id]
      );
      await runner.commitTransaction();
    } catch (e) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  private async readback(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains,
    expectedAction: 'erase' | 'readback' = 'readback'
  ): Promise<number> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction('REPEATABLE READ');
      await this.budgets(runner);
      await this.fresh(grant, expectedAction, scope);
      await this.assertAssetBindings(runner, scope);
      const assets = await this.rows(
        runner,
        `SELECT "id", "profileId", "originKind", "originProfileId", "originAppId" FROM "asset_entity" WHERE lower("profileId"::text)=ANY($1::text[]) OR lower("originProfileId"::text)=ANY($1::text[]) ORDER BY "id" LIMIT ${
          LIMIT + 1
        }`,
        [[...scope.currentProfileIds]]
      );
      if (!Array.isArray(assets) || assets.length > LIMIT)
        this.fail('READBACK_BOUND_EXCEEDED');
      let owned = 0,
        conflicts = 0;
      for (const row of assets) {
        const profile = this.uuid(row['profileId']);
        const origin =
          row['originProfileId'] == null
            ? null
            : this.uuid(row['originProfileId']);
        if (!profile || (row['originProfileId'] != null && !origin))
          this.fail('ASSET_BINDING_INVALID');
        if (scope.currentProfileIds.includes(profile)) owned++;
        if (
          row['originKind'] === 'guardian-staged' &&
          scope.currentProfileIds.includes(origin ?? '') &&
          origin !== profile
        )
          conflicts++;
      }
      const audit = (await runner.query(
        `SELECT count(*)::int AS count FROM "guardian_asset_activity" WHERE lower(btrim("actorUserId"::text))=$1 OR lower(btrim("dependentUserId"::text))=$1 OR lower(btrim("profileId"::text))=ANY($2::text[])`,
        [accountId, [...scope.currentProfileIds]]
      )) as Row[];
      const auditCount =
        Array.isArray(audit) && audit.length === 1
          ? this.count(audit[0]['count'])
          : null;
      if (auditCount === null) this.fail('READBACK_INVALID');
      await runner.commitTransaction();
      if (owned || conflicts || auditCount !== 0)
        this.fail('READBACK_INCOMPLETE');
      return owned;
    } catch (e) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  private validateBinding(row: Row, scope: AccountDeletionIdentityDomains) {
    const profile = this.uuid(row['profileId']);
    const origin =
      row['originProfileId'] == null ? null : this.uuid(row['originProfileId']);
    if (!profile || (row['originProfileId'] != null && !origin))
      this.fail('ASSET_BINDING_INVALID');
    if (!scope.currentProfileIds.includes(profile))
      this.fail('ASSET_OWNER_SCOPE_INVALID');
    if (
      row['originKind'] === 'guardian-staged' &&
      (!origin || origin !== profile)
    )
      this.fail('ASSET_ORIGIN_CONFLICT');
  }
  private dto(r: Row): AssetDto {
    const dto = new AssetDto();
    for (const key of [
      'id',
      'name',
      'type',
      'storageStrategy',
      'storagePath',
      'profileId',
    ] as const) {
      const value = r[key];
      if (typeof value !== 'string') this.fail('ASSET_METADATA_INVALID');
      (dto as unknown as Row)[key] = value;
    }
    return dto;
  }
  private async assertAssetBindings(
    runner: QueryRunner,
    scope: AccountDeletionIdentityDomains
  ) {
    const ids = [...scope.currentProfileIds];
    const rows = await this.rows(
      runner,
      `SELECT "id", "profileId", "originKind", "originProfileId", "originAppId" FROM "asset_entity" WHERE lower("profileId"::text)=ANY($1::text[]) OR lower("originProfileId"::text)=ANY($1::text[]) ORDER BY "id" LIMIT ${
        LIMIT + 1
      }`,
      [ids]
    );
    if (rows.length > LIMIT) this.fail('ASSET_LIMIT_EXCEEDED');
    for (const row of rows) {
      const profile = this.uuid(row['profileId']);
      const origin =
        row['originProfileId'] == null
          ? null
          : this.uuid(row['originProfileId']);
      if (!profile || (row['originProfileId'] != null && !origin))
        this.fail('ASSET_BINDING_INVALID');
      const profileOwned = ids.includes(profile);
      const originOwned = ids.includes(origin ?? '');
      if (
        profileOwned &&
        row['originKind'] === 'guardian-staged' &&
        (!origin || origin !== profile)
      )
        this.fail('ASSET_ORIGIN_CONFLICT');
      if (originOwned && (!profileOwned || origin !== profile))
        this.fail('ASSET_ORIGIN_CONFLICT');
    }
  }
  private async install(
    r: QueryRunner,
    operation: string,
    account: string,
    profiles: string[]
  ) {
    await r.query("SELECT set_config('ot.deletion_operation', $1, true)", [
      operation,
    ]);
    const identities: DeletionIdentity[] = [
      { kind: 'account', id: account },
      ...profiles.map((id) => ({ kind: 'profile' as const, id })),
    ];
    await installDeletionWriteFence(r.manager, operation, identities);
    for (const key of profiles.map(assetMediaReadLockKey).sort())
      await r.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        key,
      ]);
  }
  private async fresh(
    g: AccountDeletionGrant,
    action: AccountDeletionAction,
    scope: AccountDeletionIdentityDomains
  ) {
    const v = await this.authority.validate(g, 'assets', action);
    if (
      v.accountId !== g.accountId ||
      !v.scope ||
      !validateDeletionIdentityDomains(v.scope) ||
      [...v.scope.currentProfileIds].sort().join(',') !==
        [...scope.currentProfileIds].sort().join(',') ||
      v.scope.legacyProfileIds.length
    )
      this.fail('GRANT_SCOPE_CHANGED');
  }
  private async budgets(r: QueryRunner) {
    await r.query(
      "SELECT set_config('statement_timeout','8000',true), set_config('lock_timeout','4000',true)"
    );
  }
  private async rows(
    r: QueryRunner,
    sql: string,
    args: unknown[]
  ): Promise<Row[]> {
    const value = await r.query(sql, args);
    if (!Array.isArray(value) || value.some((v) => !v || typeof v !== 'object'))
      this.fail('DATABASE_RESULT_INVALID');
    return value as Row[];
  }
  private uuid(v: unknown): string | null {
    return typeof v === 'string' && UUID.test(v) && v === v.toLowerCase()
      ? v
      : null;
  }
  private count(v: unknown): number | null {
    if (typeof v !== 'number' && !(typeof v === 'string' && /^\d+$/.test(v)))
      return null;
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 && n <= LIMIT ? n : null;
  }
  private fail(code: string): never {
    throw new AssetsAccountDeletionOwnerError(code);
  }
}
