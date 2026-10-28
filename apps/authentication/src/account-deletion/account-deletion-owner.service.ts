import { AccountDeletionRuntimeService } from './account-deletion-runtime.service';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountDeletionGrant } from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountExportArtifactRetentionService } from '../account-export-jobs/account-export-artifact-retention.service';
import { installDeletionWriteFence } from '@optimistic-tanuki/storage';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FAMILY_ROWS = 10_000;
const DELETED_EMAIL = '[deleted-account]';
const OWNER_EXPORT_APPS = ['client-interface', 'local-hub'];

type Family = { name: string; table: string; sql: string; params: unknown[] };

@Injectable()
export class AccountDeletionOwnerService {
  constructor(
    private readonly authority: AccountDeletionAuthorityService,
    @Inject('AUTHENTICATION_CONNECTION') private readonly database: DataSource,
    private readonly retention: AccountExportArtifactRetentionService,
    @Optional() private readonly runtime?: AccountDeletionRuntimeService
  ) {}

  async fence(
    grant: AccountDeletionGrant
  ): Promise<{ fenced: true } | { fenced: false; scopeRequired: true }> {
    const { accountId, scope } = await this.authorize(grant, 'fence');
    // Isolated owner fixtures can omit the runtime; the full runtime readback cannot.
    if (this.runtime) {
      await this.runtimeEnvironment(grant);
      await this.runtime.fence(accountId);
    }
    const outcome = await this.retention.purgeAccount(
      accountId,
      grant.operationId
    );
    if (outcome.failed !== 0)
      throw new Error('ACCOUNT_DELETION_ARTIFACT_PURGE_FAILED');
    await this.authorize(grant, 'fence');
    await this.database.transaction(async (manager) => {
      this.assertGrantLive(grant);
      await this.setOperation(manager, grant.operationId);
      await this.installIdentityFence(manager, grant, accountId, scope);
      for (const family of this.families(
        accountId,
        scope?.currentProfileIds ?? []
      ))
        await this.assertBound(manager, family);
      await manager.query(
        'UPDATE "token" SET "revoked"=true WHERE "userId"=$1',
        [accountId]
      );
      if (scope?.currentProfileIds.length)
        await manager.query(
          'UPDATE "token" SET "revoked"=true WHERE "userId" IS NULL AND "profileId" = ANY($1::uuid[])',
          [scope.currentProfileIds]
        );
      await manager.query('DELETE FROM "oauth_provider" WHERE "userId"=$1', [
        accountId,
      ]);
      await manager.query('DELETE FROM "auth_action_token" WHERE "userId"=$1', [
        accountId,
      ]);
    });
    return scope ? { fenced: true } : { fenced: false, scopeRequired: true };
  }

  async runtimeEnvironment(grant: AccountDeletionGrant) {
    const action = grant?.action;
    if (!['fence', 'erase', 'readback', 'finalize'].includes(action))
      throw Error('AUTH_DELETION_ENVIRONMENT_ACTION_INVALID');
    await this.authorize(grant, action);
    if (!this.runtime) throw Error('AUTH_DELETION_RUNTIME_UNAVAILABLE');
    const environment = await this.runtime.environmentStatus();
    if (!environment.logging.active || !environment.databaseLogging.active)
      throw Error('DELETION_ENVIRONMENT_UNVERIFIED');
    await this.authorize(grant, action);
    return { owner: 'authentication', ...environment };
  }

  async runtimeCustody(
    grant: AccountDeletionGrant,
    probe: { nonce: string; mode: 'write' | 'read' | 'remove' }
  ) {
    const action = grant?.action;
    if (action !== 'fence' && action !== 'readback')
      throw Error('AUTH_DELETION_CUSTODY_ACTION_INVALID');
    await this.authorize(grant, action);
    if (!this.runtime) throw Error('AUTH_DELETION_RUNTIME_UNAVAILABLE');
    await this.runtimeEnvironment(grant);
    const storeId = await this.runtime.custodyProbe(probe?.nonce, probe?.mode);
    await this.authorize(grant, action);
    return { owner: 'authentication', storeId };
  }

  async runtimeReadback(grant: AccountDeletionGrant) {
    const { accountId } = await this.authorize(grant, 'readback');
    if (!this.runtime) throw Error('AUTH_DELETION_RUNTIME_UNAVAILABLE');
    await this.runtimeEnvironment(grant);
    await this.runtime.fence(accountId);
    const result = await this.runtime.readback(accountId);
    await this.authorize(grant, 'readback');
    return result;
  }

  async erase(grant: AccountDeletionGrant): Promise<{ erased: true }> {
    const { accountId, scope } = await this.authorize(grant, 'erase');
    if (!scope) throw new Error('ACCOUNT_DELETION_SCOPE_REQUIRED');
    const profileIds = scope?.currentProfileIds ?? [];
    const outcome = await this.retention.purgeAccount(
      accountId,
      grant.operationId
    );
    if (outcome.failed !== 0)
      throw new Error('ACCOUNT_DELETION_ARTIFACT_PURGE_FAILED');
    await this.authorize(grant, 'erase');
    await this.database.transaction(async (manager) => {
      this.assertGrantLive(grant);
      await this.setOperation(manager, grant.operationId);
      await this.installIdentityFence(manager, grant, accountId, scope);
      const families = this.families(accountId, profileIds);
      for (const family of families) await this.assertBound(manager, family);

      const jobs = await manager.query(
        'SELECT "coverageSummary" FROM "account_export_jobs" WHERE "accountId"=$1 AND "appId"=ANY($2::text[]) FOR UPDATE',
        [accountId, OWNER_EXPORT_APPS]
      );
      if (!Array.isArray(jobs))
        throw new Error('ACCOUNT_DELETION_EXPORT_READBACK_INVALID');
      for (const row of jobs) {
        const summary = row?.coverageSummary;
        if (summary == null) continue;
        if (typeof summary !== 'object' || Array.isArray(summary))
          throw new Error('ACCOUNT_DELETION_EXPORT_READBACK_INVALID');
        const payload = summary;
        if (
          payload.privateArtifact != null ||
          payload.privateArtifactPending != null ||
          payload.artifactState === 'cleanup-pending'
        )
          throw new Error('ACCOUNT_DELETION_ARTIFACT_CLEANUP_PENDING');
      }

      await manager.query('DELETE FROM "token" WHERE "userId"=$1', [accountId]);
      if (profileIds.length)
        await manager.query(
          'DELETE FROM "token" WHERE "userId" IS NULL AND "profileId" = ANY($1::uuid[])',
          [profileIds]
        );
      await manager.query('DELETE FROM "oauth_provider" WHERE "userId"=$1', [
        accountId,
      ]);
      await manager.query('DELETE FROM "auth_action_token" WHERE "userId"=$1', [
        accountId,
      ]);
      await manager.query(
        `UPDATE "guardian_permission" SET
          "applicantEmail"=CASE WHEN "userId"=$1 THEN $2 ELSE "applicantEmail" END,
          "dateOfBirth"=CASE WHEN "userId"=$1 THEN NULL ELSE "dateOfBirth" END,
          "userId"=CASE WHEN "userId"=$1 THEN NULL ELSE "userId" END,
          "guardianUserId"=CASE WHEN "guardianUserId"=$1 THEN NULL ELSE "guardianUserId" END,
          "guardianEmail"=CASE WHEN "guardianUserId"=$1 THEN NULL ELSE "guardianEmail" END,
          "guardianTokenHash"=NULL,"resumeTokenHash"=NULL,"withdrawalTokenHash"=NULL,
          "attestationText"=NULL,"attestationVersion"=NULL,"attestedAt"=NULL,
          "resumeExpiresAt"=NULL,"status"='revoked'
         WHERE "userId"=$1 OR "guardianUserId"=$1`,
        [accountId, DELETED_EMAIL]
      );
      await manager.query(
        'DELETE FROM "guardian_policy_notice" WHERE "guardianUserId"=$1',
        [accountId]
      );
      await manager.query(
        'DELETE FROM "account_export_jobs" WHERE "accountId"=$1 AND "appId"=ANY($2::text[])',
        [accountId, OWNER_EXPORT_APPS]
      );
    });
    return { erased: true };
  }

  async readback(grant: AccountDeletionGrant): Promise<{
    complete: boolean;
    counts: Record<string, number>;
    unresolvedAttribution: string[];
  }> {
    const { accountId, scope } = await this.authorize(grant, 'readback');
    const counts: Record<string, number> = {};
    for (const family of this.families(
      accountId,
      scope?.currentProfileIds ?? []
    )) {
      const result = await this.database.query(
        `SELECT COUNT(*)::int AS count FROM "${family.table}" WHERE ${family.sql}`,
        family.params
      );
      const count = this.readCount(result);
      if (!Number.isSafeInteger(count) || count < 0 || count > MAX_FAMILY_ROWS)
        throw new Error('ACCOUNT_DELETION_READBACK_BOUND_EXCEEDED');
      counts[family.name] = count;
    }
    const users = await this.database.query(
      'SELECT "email" FROM "user_entity" WHERE "id"=$1',
      [accountId]
    );
    if (
      !Array.isArray(users) ||
      users.length !== 1 ||
      typeof users[0]?.email !== 'string'
    )
      throw new Error('ACCOUNT_DELETION_ROOT_IDENTITY_UNAVAILABLE');
    const email = users[0].email;
    let unresolvedAttribution: string[] = [];
    if (typeof email === 'string') {
      const unresolved = await this.database.query(
        `SELECT COUNT(*)::int AS count FROM "guardian_permission"
         WHERE ("userId" IS NULL AND "applicantEmail"=$1)
            OR ("guardianUserId" IS NULL AND "guardianEmail"=$1)`,
        [email]
      );
      const count = this.readCount(unresolved);
      if (!Number.isSafeInteger(count) || count < 0 || count > MAX_FAMILY_ROWS)
        throw new Error('ACCOUNT_DELETION_READBACK_BOUND_EXCEEDED');
      if (count > 0) unresolvedAttribution = ['guardian_permission_email_only'];
    }
    return {
      complete:
        Object.values(counts).every((count) => count === 0) &&
        unresolvedAttribution.length === 0,
      counts,
      unresolvedAttribution,
    };
  }

  private async authorize(
    grant: AccountDeletionGrant,
    action: AccountDeletionGrant['action']
  ) {
    const validated = await this.authority.validateGrant(grant);
    if (grant.owner !== 'authentication' || grant.action !== action)
      throw new Error('ACCOUNT_DELETION_GRANT_OWNER_OR_ACTION_INVALID');
    if (!UUID.test(grant.operationId) || !UUID.test(validated.accountId))
      throw new Error('ACCOUNT_DELETION_GRANT_INVALID');
    if (
      validated.scope &&
      validated.scope.currentProfileIds.length +
        validated.scope.legacyProfileIds.length +
        1 >
        1000
    )
      throw new Error('ACCOUNT_DELETION_SCOPE_BOUND_EXCEEDED');
    return validated;
  }

  private assertGrantLive(grant: AccountDeletionGrant): void {
    if (Date.parse(grant.expiresAt) <= Date.now())
      throw new Error('ACCOUNT_DELETION_GRANT_STALE');
  }

  private async installIdentityFence(
    manager: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    grant: AccountDeletionGrant,
    accountId: string,
    scope: {
      readonly currentProfileIds: readonly string[];
      readonly legacyProfileIds: readonly string[];
    } | null
  ): Promise<void> {
    await installDeletionWriteFence(manager as never, grant.operationId, [
      { kind: 'account', id: accountId },
      ...(scope?.currentProfileIds ?? []).map((id) => ({
        kind: 'profile' as const,
        id,
      })),
      ...(scope?.legacyProfileIds ?? []).map((id) => ({
        kind: 'legacy-profile' as const,
        id,
      })),
    ]);
  }

  private readCount(result: unknown): number {
    if (
      !Array.isArray(result) ||
      result.length !== 1 ||
      !result[0] ||
      typeof result[0] !== 'object' ||
      !('count' in result[0])
    )
      throw new Error('ACCOUNT_DELETION_READBACK_INVALID');
    const raw = (result[0] as { count: unknown }).count;
    const count =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && /^\d+$/.test(raw)
        ? Number(raw)
        : NaN;
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_FAMILY_ROWS)
      throw new Error('ACCOUNT_DELETION_READBACK_BOUND_EXCEEDED');
    return count;
  }

  private async setOperation(
    manager: { query: (sql: string, params: unknown[]) => Promise<unknown> },
    operationId: string
  ) {
    await manager.query(
      "SELECT set_config('ot.deletion_operation', $1, true)",
      [operationId]
    );
  }

  private families(accountId: string, profiles: readonly string[]): Family[] {
    const profileParams = profiles.length ? [profiles] : [[]];
    return [
      {
        name: 'token_account',
        table: 'token',
        sql: '"userId"=$1',
        params: [accountId],
      },
      {
        name: 'token_profile',
        table: 'token',
        sql: '"profileId" = ANY($1::uuid[])',
        params: profileParams,
      },
      {
        name: 'oauth_provider',
        table: 'oauth_provider',
        sql: '"userId"=$1',
        params: [accountId],
      },
      {
        name: 'auth_action_token',
        table: 'auth_action_token',
        sql: '"userId"=$1',
        params: [accountId],
      },
      {
        name: 'guardian_permission',
        table: 'guardian_permission',
        sql: '"userId"=$1 OR "guardianUserId"=$1',
        params: [accountId],
      },
      {
        name: 'guardian_policy_notice',
        table: 'guardian_policy_notice',
        sql: '"guardianUserId"=$1',
        params: [accountId],
      },
      {
        name: 'account_export_jobs',
        table: 'account_export_jobs',
        sql: '"accountId"=$1 AND "appId"=ANY($2::text[])',
        params: [accountId, OWNER_EXPORT_APPS],
      },
    ];
  }

  private async assertBound(
    manager: { query: (sql: string, params: unknown[]) => Promise<any> },
    family: Family
  ) {
    const rows = await manager.query(
      `SELECT COUNT(*)::int AS count FROM "${family.table}" WHERE ${family.sql}`,
      family.params
    );
    const count = this.readCount(rows);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_FAMILY_ROWS)
      throw new Error('ACCOUNT_DELETION_ERASE_BOUND_EXCEEDED');
  }
}
