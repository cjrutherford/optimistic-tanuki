import { Inject, Injectable } from '@nestjs/common';
import {
  AccountDeletionAction,
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  validateDeletionIdentityDomains,
  validateDeletionGrantShape,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  DeletionIdentity,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';
import { DataSource, QueryRunner } from 'typeorm';
import { ProfileAuditErasureService } from './audit-erasure.service';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROFILE_LIMIT = 999;
const LEGACY_LIMIT = 10_000;
type Row = Record<string, unknown>;

export class ProfileAccountDeletionOwnerError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProfileAccountDeletionOwnerError';
  }
}

/** Owner-local deletion coordinator. Identity rows remain as stable references through D26. */
@Injectable()
export class ProfileAccountDeletionOwnerService {
  constructor(
    @Inject('PROFILE_CONNECTION') private readonly dataSource: DataSource,
    private readonly authority: AccountDeletionAuthorityClient,
    private readonly audit: ProfileAuditErasureService
  ) {}

  async execute(
    value: unknown,
    requestedAction: AccountDeletionAction
  ): Promise<{
    fenced: boolean;
    profileCount: number;
    legacyCount: number;
    scope?: AccountDeletionIdentityDomains;
  }> {
    if (!['fence', 'erase', 'readback'].includes(requestedAction))
      throw new ProfileAccountDeletionOwnerError('ACTION_INVALID');
    if (!validateDeletionGrantShape(value))
      throw new ProfileAccountDeletionOwnerError('GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const verified = await this.authority.validate(
      grant,
      'profile',
      requestedAction
    );
    const accountId = verified.accountId;
    if (!UUID.test(accountId) || accountId !== accountId.toLowerCase())
      throw new ProfileAccountDeletionOwnerError('ACCOUNT_INVALID');
    if (requestedAction === 'fence')
      return this.fence(grant, accountId, verified.scope);
    const scope = verified.scope;
    if (!scope || !validateDeletionIdentityDomains(scope))
      throw new ProfileAccountDeletionOwnerError('SCOPE_REQUIRED');
    this.assertNoLegacyProfileKeys(scope);
    if (requestedAction === 'erase') await this.erase(grant, accountId, scope);
    else await this.readback(grant, accountId, scope);
    return {
      fenced: true,
      profileCount: scope.currentProfileIds.length,
      legacyCount: scope.legacyProfileIds.length,
    };
  }

  private async fence(
    grant: AccountDeletionGrant,
    accountId: string,
    authorityScope: AccountDeletionIdentityDomains | null
  ) {
    const runner = this.dataSource.createQueryRunner();
    let committed = false;
    try {
      await runner.connect();
      await runner.startTransaction();
      await this.setBudgets(runner);
      const discovered = await this.discoverProfiles(runner, accountId);
      await this.installFences(
        runner,
        grant.operationId,
        accountId,
        discovered
      );
      const after = await this.discoverProfiles(runner, accountId);
      if (!same(discovered, after))
        throw new ProfileAccountDeletionOwnerError('PROFILE_DISCOVERY_CHANGED');
      const scope: AccountDeletionIdentityDomains = {
        currentProfileIds: discovered,
        legacyProfileIds: [],
      };
      if (authorityScope && !sameScope(authorityScope, scope))
        throw new ProfileAccountDeletionOwnerError('SCOPE_MISMATCH');
      await runner.commitTransaction();
      committed = true;
      await this.authority.recordProfileScope(grant, scope);
      return {
        fenced: true,
        profileCount: scope.currentProfileIds.length,
        legacyCount: 0,
        scope,
      };
    } catch (error) {
      if (!committed && runner.isTransactionActive)
        await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async erase(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains
  ): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    let committed = false;
    try {
      await runner.connect();
      await runner.startTransaction();
      await this.setBudgets(runner);
      await this.assertFreshGrant(grant, 'erase', scope);
      await this.installFences(runner, grant.operationId, accountId, [
        ...scope.currentProfileIds,
      ]);
      await this.assertScopeMapping(runner, accountId, scope);
      const goalIds = await this.ownedIds(runner, 'goal', accountId);
      const projectIds = await this.ownedIds(runner, 'project', accountId);
      const timelineIds = await this.ownedIds(runner, 'timeline', accountId);
      this.assertAssociationLimit(goalIds, projectIds, timelineIds);
      // These are references from other retained rows: detach only the FK, preserving all content.
      await this.detachReferences(runner, 'project', 'goalsId', goalIds);
      await this.detachReferences(
        runner,
        'goal',
        'relatedProjectId',
        projectIds
      );
      await this.detachReferences(runner, 'timeline', 'relatedGoalId', goalIds);
      await this.detachReferences(
        runner,
        'timeline',
        'relatedProjectId',
        projectIds
      );
      await this.detachReferences(
        runner,
        'project',
        'timeLineEventsId',
        timelineIds
      );
      for (const table of ['goal', 'project', 'timeline'] as const)
        await this.detachReferences(
          runner,
          table,
          'relatedProfileId',
          scope.currentProfileIds
        );
      // Keep profile ID/userId/appScope stable while clearing profile personal projection fields.
      if (scope.currentProfileIds.length)
        await runner.query(
          `UPDATE "profile" SET "profileName"='Deleted account', "profilePic"='', "coverPic"='', "bio"='', "location"='', "occupation"='', "interests"='', "skills"='', "blogRole"='none' WHERE "id" = ANY($1::uuid[])`,
          [scope.currentProfileIds]
        );
      await runner.query('DELETE FROM "timeline" WHERE lower("userId") = $1', [
        accountId,
      ]);
      await runner.query('DELETE FROM "goal" WHERE lower("userId") = $1', [
        accountId,
      ]);
      await runner.query('DELETE FROM "project" WHERE lower("userId") = $1', [
        accountId,
      ]);
      await this.proveIdentityRows(runner, accountId, scope);
      await runner.commitTransaction();
      committed = true;
    } catch (error) {
      if (!committed && runner.isTransactionActive)
        await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    await this.assertFreshGrant(grant, 'erase', scope);
    const receipt = (await this.audit.eraseParticipation(
      { accountId, profileIds: [...scope.currentProfileIds] } as never,
      grant.operationId
    )) as { allDeclaredSourcesVerified?: boolean };
    if (receipt?.allDeclaredSourcesVerified !== true)
      throw new ProfileAccountDeletionOwnerError('AUDIT_ERASURE_INCOMPLETE');
  }

  private async readback(
    grant: AccountDeletionGrant,
    accountId: string,
    scope: AccountDeletionIdentityDomains
  ): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction('REPEATABLE READ');
      await this.setBudgets(runner);
      await this.assertFreshGrant(grant, 'readback', scope);
      await this.assertScopeMapping(runner, accountId, scope);
      await this.proveIdentityRows(runner, accountId, scope);
      const profiles = (await runner.query(
        'SELECT "profileName", "profilePic", "coverPic", "bio", "location", "occupation", "interests", "skills", "blogRole" FROM "profile" WHERE "id" = ANY($1::uuid[])',
        [scope.currentProfileIds]
      )) as Row[];
      if (
        profiles.length !== scope.currentProfileIds.length ||
        profiles.some(
          (p) =>
            p['profileName'] !== 'Deleted account' ||
            [
              'profilePic',
              'coverPic',
              'bio',
              'location',
              'occupation',
              'interests',
              'skills',
            ].some((k) => p[k] !== '') ||
            p['blogRole'] !== 'none'
        )
      )
        throw new ProfileAccountDeletionOwnerError(
          'PROFILE_PROJECTION_NOT_CLEARED'
        );
      for (const table of ['goal', 'project', 'timeline'] as const)
        if ((await this.ownedIds(runner, table, accountId)).length)
          throw new ProfileAccountDeletionOwnerError(
            'OWNED_LEGACY_ROWS_REMAIN'
          );
      const auditRows = (await runner.query(
        'SELECT count(*)::int AS count FROM "guardian_profile_activity" WHERE "actorUserId"=$1::uuid OR "dependentUserId"=$1::uuid OR "profileId" = ANY($2::uuid[])',
        [accountId, scope.currentProfileIds]
      )) as Row[];
      if (!auditRows.length || Number(auditRows[0]['count']) !== 0)
        throw new ProfileAccountDeletionOwnerError('AUDIT_IDENTIFIERS_REMAIN');
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async assertScopeMapping(
    runner: QueryRunner,
    accountId: string,
    scope: AccountDeletionIdentityDomains
  ) {
    const rows = (await runner.query(
      'SELECT "id" FROM "profile" WHERE lower("userId")=$1 ORDER BY "id" LIMIT 1001',
      [accountId]
    )) as Row[];
    const ids = rows.map((r) => canonicalUuid(r['id']));
    if (
      rows.length > PROFILE_LIMIT ||
      ids.some((id) => !id) ||
      new Set(ids).size !== ids.length ||
      !same(ids, [...scope.currentProfileIds].sort())
    )
      throw new ProfileAccountDeletionOwnerError('SCOPE_MISMATCH');
  }
  private async proveIdentityRows(
    runner: QueryRunner,
    accountId: string,
    scope: AccountDeletionIdentityDomains
  ) {
    const rows = (await runner.query(
      'SELECT "id", "userId", "appScope" FROM "profile" WHERE "id" = ANY($1::uuid[]) ORDER BY "id"',
      [scope.currentProfileIds]
    )) as Row[];
    if (
      rows.length !== scope.currentProfileIds.length ||
      rows.some(
        (r) =>
          typeof r['id'] !== 'string' ||
          typeof r['userId'] !== 'string' ||
          r['userId'].toLowerCase() !== accountId ||
          !(r['appScope'] === null || typeof r['appScope'] === 'string')
      )
    )
      throw new ProfileAccountDeletionOwnerError('IDENTITY_ROWS_CHANGED');
  }
  private async discoverProfiles(runner: QueryRunner, accountId: string) {
    const rows = (await runner.query(
      'SELECT "id" FROM "profile" WHERE lower("userId")=$1 ORDER BY "id" LIMIT 1001',
      [accountId]
    )) as Row[];
    if (rows.length > 1000)
      throw new ProfileAccountDeletionOwnerError('PROFILE_LIMIT_EXCEEDED');
    const ids = rows.map((r) => canonicalUuid(r['id']));
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new ProfileAccountDeletionOwnerError('PROFILE_ID_INVALID');
    return ids.sort();
  }
  private async ownedIds(
    runner: QueryRunner,
    table: 'goal' | 'project' | 'timeline',
    accountId: string
  ) {
    const rows = (await runner.query(
      `SELECT "id" FROM "${table}" WHERE lower("userId")=$1 ORDER BY "id" LIMIT ${
        LEGACY_LIMIT + 1
      }`,
      [accountId]
    )) as Row[];
    if (rows.length > LEGACY_LIMIT)
      throw new ProfileAccountDeletionOwnerError('LEGACY_LIMIT_EXCEEDED');
    const ids = rows.map((r) => canonicalUuid(r['id']));
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
      throw new ProfileAccountDeletionOwnerError('LEGACY_ID_INVALID');
    return ids;
  }
  private async detachReferences(
    runner: QueryRunner,
    table: 'goal' | 'project' | 'timeline',
    column:
      | 'goalsId'
      | 'relatedProjectId'
      | 'relatedGoalId'
      | 'timeLineEventsId'
      | 'relatedProfileId',
    ids: readonly string[]
  ) {
    if (!ids.length) return;
    const rows = await runner.query(
      `SELECT count(*)::int AS count FROM "${table}" WHERE "${column}" = ANY($1::uuid[])`,
      [ids]
    );
    if (
      !Array.isArray(rows) ||
      rows.length !== 1 ||
      !Number.isSafeInteger(rows[0]?.count) ||
      rows[0].count < 0 ||
      rows[0].count > LEGACY_LIMIT
    )
      throw new ProfileAccountDeletionOwnerError('ASSOCIATION_BOUND_EXCEEDED');
    await runner.query(
      `UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" = ANY($1::uuid[])`,
      [ids]
    );
  }

  private async installFences(
    runner: QueryRunner,
    operationId: string,
    accountId: string,
    profileIds: string[]
  ) {
    await runner.query("SELECT set_config('ot.deletion_operation', $1, true)", [
      operationId,
    ]);
    const identities: DeletionIdentity[] = [
      { kind: 'account', id: accountId },
      ...profileIds.map((id) => ({ kind: 'profile' as const, id })),
    ];
    await installDeletionWriteFence(runner.manager, operationId, identities);
  }
  private async assertFreshGrant(
    grant: AccountDeletionGrant,
    action: 'erase' | 'readback',
    scope: AccountDeletionIdentityDomains
  ) {
    const verified = await this.authority.validate(grant, 'profile', action);
    if (
      verified.accountId !== grant.accountId ||
      !verified.scope ||
      !validateDeletionIdentityDomains(verified.scope) ||
      !sameScope(verified.scope, scope)
    )
      throw new ProfileAccountDeletionOwnerError('SCOPE_MISMATCH');
    if (Date.parse(grant.expiresAt) <= Date.now())
      throw new ProfileAccountDeletionOwnerError('GRANT_EXPIRED');
  }
  private assertAssociationLimit(...groups: string[][]) {
    if (groups.some((ids) => ids.length > LEGACY_LIMIT))
      throw new ProfileAccountDeletionOwnerError('LEGACY_LIMIT_EXCEEDED');
  }
  private async setBudgets(runner: QueryRunner) {
    await runner.query("SET LOCAL statement_timeout = '8s'");
    await runner.query("SET LOCAL lock_timeout = '4s'");
  }
  private assertNoLegacyProfileKeys(scope: AccountDeletionIdentityDomains) {
    if (scope.legacyProfileIds.length)
      throw new ProfileAccountDeletionOwnerError(
        'LEGACY_PROFILE_CATALOG_UNAVAILABLE'
      );
  }
}
function canonicalUuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !UUID.test(value) ||
    value !== value.toLowerCase()
  )
    return '';
  return value;
}
function same(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
function sameScope(
  a: AccountDeletionIdentityDomains,
  b: AccountDeletionIdentityDomains
) {
  return (
    same([...a.currentProfileIds].sort(), [...b.currentProfileIds].sort()) &&
    same([...a.legacyProfileIds].sort(), [...b.legacyProfileIds].sort())
  );
}
