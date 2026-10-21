import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthCommands,
  PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerChunk,
  AccountExportOwnerFailureCode,
  AccountExportOwnerRecord,
  AccountExportSnapshotDescriptor,
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

export const PERMISSIONS_ACCOUNT_EXPORT_SOURCES =
  PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES;
export type PermissionsAccountExportSource =
  (typeof PERMISSIONS_ACCOUNT_EXPORT_SOURCES)[number];
export type PermissionsAccountExportChunk =
  AccountExportOwnerChunk<PermissionsAccountExportSource>;
export interface PermissionsAccountExportOptions {
  grant: AccountExportCaptureGrant;
  profileSnapshot: AccountExportSnapshotDescriptor;
  onChunk: (
    chunk: PermissionsAccountExportChunk,
    signal?: AbortSignal
  ) => Promise<void>;
  signal?: AbortSignal;
  captureTimeoutMs?: number;
}

export class PermissionsAccountExportOwnerError extends Error {
  constructor(readonly code: AccountExportOwnerFailureCode | string) {
    super(code);
    this.name = 'PermissionsAccountExportOwnerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 200;
const MAX = {
  name: 1024,
  description: 65_536,
  target: 4096,
};

const selectText = (
  alias: string,
  column: string,
  limit: number,
  output = column
) =>
  `left(${alias}."${column}"::text,${
    limit + 1
  }) AS "${output}",char_length(${alias}."${column}"::text) AS "${output}Length"`;

function assignmentQuery(temp: string): string {
  return `SELECT a."id"::text AS "id",${selectText(
    'a',
    'profileId',
    36
  )},${selectText(
    'a',
    'targetId',
    MAX.target
  )},a."roleId"::text AS "roleId",a."appScopeId"::text AS "appScopeId",a."created_at"::text AS "createdAt",r."id"::text AS "roleContextId",${selectText(
    'r',
    'name',
    MAX.name,
    'roleName'
  )},${selectText(
    'r',
    'description',
    MAX.description,
    'roleDescription'
  )},r."appScopeId"::text AS "roleAppScopeId",r."created_at"::text AS "roleCreatedAt",s."id"::text AS "assignmentScopeContextId",${selectText(
    's',
    'name',
    MAX.name,
    'assignmentScopeName'
  )},${selectText(
    's',
    'description',
    MAX.description,
    'assignmentScopeDescription'
  )},s."active" AS "assignmentScopeActive",s."created_at"::text AS "assignmentScopeCreatedAt",s."updated_at"::text AS "assignmentScopeUpdatedAt",rs."id"::text AS "roleScopeContextId",${selectText(
    'rs',
    'name',
    MAX.name,
    'roleScopeName'
  )},${selectText(
    'rs',
    'description',
    MAX.description,
    'roleScopeDescription'
  )},rs."active" AS "roleScopeActive",rs."created_at"::text AS "roleScopeCreatedAt",rs."updated_at"::text AS "roleScopeUpdatedAt" FROM "role_assignment" a JOIN "${temp}" owned ON owned."id"::text=lower(a."profileId") LEFT JOIN "role" r ON r."id"=a."roleId" LEFT JOIN "app_scope" s ON s."id"=a."appScopeId" LEFT JOIN "app_scope" rs ON rs."id"=r."appScopeId" WHERE ($1::uuid IS NULL OR a."id">$1::uuid) ORDER BY a."id" LIMIT $2`;
}

function rolePermissionQuery(temp: string): string {
  return `SELECT rp."role_id"::text AS "roleId",rp."permission_id"::text AS "permissionId",r."id"::text AS "roleContextId",${selectText(
    'r',
    'name',
    MAX.name,
    'roleName'
  )},${selectText(
    'r',
    'description',
    MAX.description,
    'roleDescription'
  )},r."appScopeId"::text AS "roleAppScopeId",r."created_at"::text AS "roleCreatedAt",rs."id"::text AS "roleScopeContextId",${selectText(
    'rs',
    'name',
    MAX.name,
    'roleScopeName'
  )},${selectText(
    'rs',
    'description',
    MAX.description,
    'roleScopeDescription'
  )},rs."active" AS "roleScopeActive",rs."created_at"::text AS "roleScopeCreatedAt",rs."updated_at"::text AS "roleScopeUpdatedAt",p."id"::text AS "permissionContextId",${selectText(
    'p',
    'name',
    MAX.name,
    'permissionName'
  )},${selectText(
    'p',
    'description',
    MAX.description,
    'permissionDescription'
  )},${selectText(
    'p',
    'resource',
    MAX.name,
    'permissionResource'
  )},${selectText('p', 'action', MAX.name, 'permissionAction')},${selectText(
    'p',
    'targetId',
    MAX.target,
    'permissionTargetId'
  )},p."appScopeId"::text AS "permissionAppScopeId",p."created_at"::text AS "permissionCreatedAt",ps."id"::text AS "permissionScopeContextId",${selectText(
    'ps',
    'name',
    MAX.name,
    'permissionScopeName'
  )},${selectText(
    'ps',
    'description',
    MAX.description,
    'permissionScopeDescription'
  )},ps."active" AS "permissionScopeActive",ps."created_at"::text AS "permissionScopeCreatedAt",ps."updated_at"::text AS "permissionScopeUpdatedAt" FROM "role_permissions" rp LEFT JOIN "role" r ON r."id"=rp."role_id" LEFT JOIN "app_scope" rs ON rs."id"=r."appScopeId" LEFT JOIN "permission" p ON p."id"=rp."permission_id" LEFT JOIN "app_scope" ps ON ps."id"=p."appScopeId" WHERE EXISTS (SELECT 1 FROM "role_assignment" a JOIN "${temp}" owned ON owned."id"::text=lower(a."profileId") WHERE a."roleId"=rp."role_id") AND ($1::uuid IS NULL OR (rp."role_id",rp."permission_id")>($1::uuid,$2::uuid)) ORDER BY rp."role_id",rp."permission_id" LIMIT $3`;
}

/** Read-only Permissions capture tied to all identities in a leased Profile snapshot. */
@Injectable()
export class PermissionsAccountExportOwnerService {
  private busy = false;
  private quarantined = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: AccountExportProfileSnapshotClient,
    private readonly authClient: ClientProxy
  ) {}

  async captureAccount(
    value: PermissionsAccountExportOptions
  ): Promise<PermissionsAccountExportChunk> {
    if (this.busy || this.quarantined)
      throw new PermissionsAccountExportOwnerError('OWNER_READ_FAILED');
    if (
      !value ||
      !isAccountExportCaptureGrant(value.grant) ||
      !this.validDescriptor(value.profileSnapshot) ||
      value.profileSnapshot.accountId !== value.grant.accountId ||
      typeof value.onChunk !== 'function'
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED'
      );

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
      throw new PermissionsAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED'
      );

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
    let failureCode: string | undefined;
    try {
      await this.validateLease(grant, abort.signal, deadline);
      runner = this.dataSource.createQueryRunner();
      await runner.connect();
      this.active(abort.signal, deadline);
      temp = `permissions_export_scope_${randomUUID().replace(/-/g, '')}`;
      await runner.query(
        `CREATE TEMP TABLE "${temp}" ("id" uuid PRIMARY KEY) ON COMMIT PRESERVE ROWS`
      );
      await runner.startTransaction('REPEATABLE READ');
      transaction = true;
      await runner.query('SET TRANSACTION READ ONLY');
      await runner.query(`SET LOCAL statement_timeout = '10s'`);
      await runner.query(`SET LOCAL lock_timeout = '2s'`);
      const [{ snapshotAt } = {}] = await this.query(
        runner,
        'SELECT transaction_timestamp()::text AS "snapshotAt"',
        [],
        abort.signal,
        deadline
      );
      if (
        typeof snapshotAt !== 'string' ||
        !Number.isFinite(Date.parse(snapshotAt))
      )
        throw new PermissionsAccountExportOwnerError('OWNER_READ_FAILED');
      await this.identities.readIdentities(
        grant,
        descriptor,
        async (ids) =>
          this.insertIds(runner!, temp, ids, abort.signal, deadline),
        abort.signal
      );

      const emitter =
        new AccountExportOwnerEmitter<PermissionsAccountExportSource>(
          {
            participantId: 'permissions',
            accountId: grant.accountId,
            captureId: randomUUID(),
            snapshotAt,
            sources: PERMISSIONS_ACCOUNT_EXPORT_SOURCES,
            signal: abort.signal,
          },
          async (chunk) => {
            try {
              await this.validateLease(grant, abort.signal, deadline);
            } catch (error) {
              if (error instanceof PermissionsAccountExportOwnerError)
                failureCode = error.code;
              throw error;
            }
            this.active(abort.signal, deadline);
            try {
              await onChunk(chunk, abort.signal);
            } catch {
              failureCode = 'OWNER_STREAM_CONSUMER_FAILED';
              throw new PermissionsAccountExportOwnerError(
                'OWNER_STREAM_CONSUMER_FAILED'
              );
            }
            this.active(abort.signal, deadline);
          }
        );
      await emitter.emitSources({
        roleAssignment: () =>
          this.assignments(runner!, temp, abort.signal, deadline),
        rolePermission: () =>
          this.rolePermissions(runner!, temp, abort.signal, deadline),
      });
      this.active(abort.signal, deadline);
      await runner.commitTransaction();
      transaction = false;
      try {
        await runner.query(`DROP TABLE IF EXISTS "${temp}"`);
      } catch (error) {
        clean = false;
        throw error;
      }
      temp = '';
      try {
        await runner.release();
      } catch (error) {
        clean = false;
        throw error;
      }
      runner = undefined;
      await this.validateLease(grant, abort.signal, deadline);
      this.active(abort.signal, deadline);
      return await emitter.complete();
    } catch (error) {
      if (abort.signal.aborted)
        throw new PermissionsAccountExportOwnerError(
          external?.aborted ? 'OWNER_CAPTURE_ABORTED' : 'OWNER_CAPTURE_TIMEOUT'
        );
      if (error instanceof PermissionsAccountExportOwnerError) throw error;
      if (
        error instanceof Error &&
        error.name === 'AccountExportOwnerEmitterError' &&
        failureCode
      )
        throw new PermissionsAccountExportOwnerError(failureCode);
      throw new PermissionsAccountExportOwnerError('OWNER_READ_FAILED');
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
          const evict = (
            runner as unknown as {
              releasePostgresConnection?: (error: Error) => Promise<void>;
            }
          ).releasePostgresConnection;
          if (typeof evict === 'function') {
            try {
              await evict.call(
                runner,
                new Error('PERMISSIONS_ACCOUNT_EXPORT_CLEANUP_FAILED')
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

  private async *assignments(
    runner: QueryRunner,
    temp: string,
    signal: AbortSignal,
    deadline: number
  ): AsyncIterable<AccountExportOwnerRecord<PermissionsAccountExportSource>> {
    let cursor: string | null = null;
    while (true) {
      const rows = await this.query(
        runner,
        assignmentQuery(temp),
        [cursor, PAGE + 1],
        signal,
        deadline
      );
      for (const row of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        const data = this.assignmentRecord(row);
        yield { source: 'roleAssignment', data };
        cursor = String(row.id).toLowerCase();
      }
      if (rows.length <= PAGE) break;
    }
  }

  private async *rolePermissions(
    runner: QueryRunner,
    temp: string,
    signal: AbortSignal,
    deadline: number
  ): AsyncIterable<AccountExportOwnerRecord<PermissionsAccountExportSource>> {
    let roleCursor: string | null = null;
    let permissionCursor: string | null = null;
    while (true) {
      const rows = await this.query(
        runner,
        rolePermissionQuery(temp),
        [roleCursor, permissionCursor, PAGE + 1],
        signal,
        deadline
      );
      for (const row of rows.slice(0, PAGE)) {
        this.active(signal, deadline);
        const data = this.rolePermissionRecord(row);
        yield { source: 'rolePermission', data };
        roleCursor = String(row.roleId).toLowerCase();
        permissionCursor = String(row.permissionId).toLowerCase();
      }
      if (rows.length <= PAGE) break;
    }
  }

  private assignmentRecord(
    row: Record<string, unknown>
  ): Record<string, unknown> {
    const id = this.uuid(row.id);
    const profileId = this.uuid(row.profileId);
    const roleId = this.uuid(row.roleId);
    const appScopeId = this.nullableUuid(row.appScopeId);
    const roleContextId = this.uuid(row.roleContextId);
    const roleAppScopeId = this.nullableUuid(row.roleAppScopeId);
    if (
      !id ||
      !profileId ||
      !roleId ||
      !roleContextId ||
      roleContextId !== roleId ||
      (row.appScopeId != null && !appScopeId) ||
      (row.roleAppScopeId != null && !roleAppScopeId) ||
      (appScopeId && !this.scope(row, 'assignmentScope', appScopeId)) ||
      (roleAppScopeId && !this.scope(row, 'roleScope', roleAppScopeId))
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    const targetId = this.bounded(row, 'targetId', MAX.target, true);
    this.bounded(row, 'profileId', 36, false);
    const role = {
      id: roleId,
      name: this.bounded(row, 'roleName', MAX.name, false),
      description: this.bounded(row, 'roleDescription', MAX.description, false),
      appScopeId: roleAppScopeId,
      createdAt: this.timestamp(row.roleCreatedAt),
      appScope: roleAppScopeId
        ? this.scope(row, 'roleScope', roleAppScopeId)
        : null,
    };
    return {
      id,
      profileId,
      roleId,
      appScopeId,
      targetId,
      createdAt: this.timestamp(row.createdAt),
      role,
      appScope: appScopeId
        ? this.scope(row, 'assignmentScope', appScopeId)
        : null,
    };
  }

  private rolePermissionRecord(
    row: Record<string, unknown>
  ): Record<string, unknown> {
    const roleId = this.uuid(row.roleId);
    const permissionId = this.uuid(row.permissionId);
    if (
      !roleId ||
      !permissionId ||
      this.uuid(row.roleContextId) !== roleId ||
      this.uuid(row.permissionContextId) !== permissionId
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    const roleAppScopeId = this.nullableUuid(row.roleAppScopeId);
    const permissionAppScopeId = this.nullableUuid(row.permissionAppScopeId);
    if (
      (row.roleAppScopeId != null && !roleAppScopeId) ||
      (row.permissionAppScopeId != null && !permissionAppScopeId) ||
      (roleAppScopeId && !this.scope(row, 'roleScope', roleAppScopeId)) ||
      (permissionAppScopeId &&
        !this.scope(row, 'permissionScope', permissionAppScopeId))
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    const role = {
      id: roleId,
      name: this.bounded(row, 'roleName', MAX.name, false),
      description: this.bounded(row, 'roleDescription', MAX.description, false),
      appScopeId: roleAppScopeId,
      createdAt: this.timestamp(row.roleCreatedAt),
      appScope: roleAppScopeId
        ? this.scope(row, 'roleScope', roleAppScopeId)
        : null,
    };
    const permission = {
      id: permissionId,
      name: this.bounded(row, 'permissionName', MAX.name, false),
      description: this.bounded(
        row,
        'permissionDescription',
        MAX.description,
        false
      ),
      resource: this.bounded(row, 'permissionResource', MAX.name, false),
      action: this.bounded(row, 'permissionAction', MAX.name, false),
      targetId: this.bounded(row, 'permissionTargetId', MAX.target, true),
      appScopeId: permissionAppScopeId,
      createdAt: this.timestamp(row.permissionCreatedAt),
      appScope: permissionAppScopeId
        ? this.scope(row, 'permissionScope', permissionAppScopeId)
        : null,
    };
    return {
      id: `${roleId}:${permissionId}`,
      roleId,
      permissionId,
      role,
      permission,
    };
  }

  private scope(
    row: Record<string, unknown>,
    prefix: 'assignmentScope' | 'roleScope' | 'permissionScope',
    id: string
  ): Record<string, unknown> | null {
    if (this.uuid(row[`${prefix}ContextId`]) !== id)
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    return {
      id,
      name: this.bounded(row, `${prefix}Name`, MAX.name, false),
      description: this.bounded(
        row,
        `${prefix}Description`,
        MAX.description,
        false
      ),
      active: this.boolean(row[`${prefix}Active`]),
      createdAt: this.timestamp(row[`${prefix}CreatedAt`]),
      updatedAt: this.nullableTimestamp(row[`${prefix}UpdatedAt`]),
    };
  }

  private bounded(
    row: Record<string, unknown>,
    field: string,
    max: number,
    nullable: boolean
  ): string | null {
    const value = row[field];
    const length = row[`${field}Length`];
    if (value == null && nullable && length == null) return null;
    const actualLength =
      typeof value === 'string' ? Array.from(value).length : -1;
    if (
      typeof value !== 'string' ||
      actualLength > max ||
      length == null ||
      !Number.isSafeInteger(Number(length)) ||
      Number(length) < 0 ||
      Number(length) !== actualLength ||
      Number(length) > max
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    return value;
  }

  private boolean(value: unknown): boolean {
    if (typeof value !== 'boolean')
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    return value;
  }

  private timestamp(value: unknown): string {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    return value;
  }

  private nullableTimestamp(value: unknown): string | null {
    return value == null ? null : this.timestamp(value);
  }

  private uuid(value: unknown): string | null {
    return typeof value === 'string' && UUID.test(value)
      ? value.toLowerCase()
      : null;
  }

  private nullableUuid(value: unknown): string | null {
    return value == null ? null : this.uuid(value);
  }

  private async insertIds(
    runner: QueryRunner,
    temp: string,
    ids: readonly string[],
    signal: AbortSignal,
    deadline: number
  ): Promise<void> {
    this.active(signal, deadline);
    if (
      !Array.isArray(ids) ||
      ids.length > ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize ||
      ids.some((id) => !UUID.test(id))
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_RELATIONSHIP_AMBIGUOUS'
      );
    if (ids.length)
      await this.query(
        runner,
        `INSERT INTO "${temp}" ("id") SELECT unnest($1::uuid[])`,
        [ids],
        signal,
        deadline
      );
    this.active(signal, deadline);
  }

  private async query(
    runner: QueryRunner,
    sql: string,
    params: unknown[],
    signal: AbortSignal,
    deadline: number
  ): Promise<Record<string, unknown>[]> {
    this.active(signal, deadline);
    try {
      const rows = await runner.query(sql, params);
      this.active(signal, deadline);
      return rows as Record<string, unknown>[];
    } catch (error) {
      if (error instanceof PermissionsAccountExportOwnerError) throw error;
      throw new PermissionsAccountExportOwnerError('OWNER_READ_FAILED');
    }
  }

  private async validateLease(
    grant: AccountExportCaptureGrant,
    signal: AbortSignal,
    deadline: number
  ): Promise<void> {
    this.active(signal, deadline);
    let response: unknown;
    try {
      response = await firstValueFrom(
        this.authClient
          .send({ cmd: AuthCommands.ValidateAccountExportLease }, grant)
          .pipe(timeout(3000))
      );
    } catch {
      throw new PermissionsAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED'
      );
    }
    this.active(signal, deadline);
    if (
      !response ||
      typeof response !== 'object' ||
      Object.keys(response).length !== 1 ||
      (response as { valid?: unknown }).valid !== true
    )
      throw new PermissionsAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED'
      );
  }

  private active(signal: AbortSignal, deadline: number): void {
    if (signal.aborted || Date.now() >= deadline)
      throw new PermissionsAccountExportOwnerError(
        Date.now() >= deadline
          ? 'OWNER_CAPTURE_TIMEOUT'
          : 'OWNER_CAPTURE_ABORTED'
      );
  }

  private validDescriptor(
    value: unknown
  ): value is AccountExportSnapshotDescriptor {
    const d = value as AccountExportSnapshotDescriptor | null;
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
