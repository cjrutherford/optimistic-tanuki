import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AccountDeletionAction,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';
import { SOCIAL_DELETION_COLUMNS } from './account-deletion-columns';
import { SOCIAL_DELETION_IDENTITIES } from './account-deletion-policy';
import { SocialAccountDeletionContentService } from './account-deletion-content.service';
import { SocialAccountDeletionStateService } from './account-deletion-state.service';
import { SocialAccountDeletionRelatedService } from './account-deletion-related.service';
import { SocialAuditErasureService } from './audit-erasure.service';
import { NotificationService } from './services/notification.service';

@Injectable()
export class SocialAccountDeletionOwnerService {
  constructor(
    @Inject('SOCIAL_CONNECTION') private readonly database: DataSource,
    private readonly authority: AccountDeletionAuthorityClient,
    private readonly content: SocialAccountDeletionContentService,
    private readonly state: SocialAccountDeletionStateService,
    private readonly related: SocialAccountDeletionRelatedService,
    private readonly audit: SocialAuditErasureService,
    private readonly notifications: NotificationService
  ) {}
  private async catalog(manager: EntityManager) {
    const rows = await manager.query(
      `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,column_name`
    );
    if (!Array.isArray(rows)) throw Error('SOCIAL_DELETION_CATALOG_INVALID');
    const actual: Record<string, string[]> = {};
    for (const row of rows) {
      if (row.table_name === 'migrations') continue;
      (actual[row.table_name] ??= []).push(row.column_name);
    }
    const normalized = (value: Record<string, readonly string[]>) =>
      JSON.stringify(
        Object.keys(value)
          .sort()
          .map((table) => [table, [...value[table]].sort()])
      );
    if (normalized(actual) !== normalized(SOCIAL_DELETION_COLUMNS))
      throw Error('SOCIAL_DELETION_CATALOG_DRIFT');
    const mapped = Object.fromEntries(
      this.database.entityMetadatas.map((meta) => [
        meta.tableName,
        meta.columns.map((column) => column.databaseName),
      ])
    );
    if (normalized(mapped) !== normalized(SOCIAL_DELETION_COLUMNS))
      throw Error('SOCIAL_DELETION_METADATA_DRIFT');
  }
  private async counts(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    let remaining = 0;
    for (const [table, columns] of Object.entries(SOCIAL_DELETION_IDENTITIES)) {
      if (!columns.length) continue;
      const where = columns
        .map(
          ([column, kind]) =>
            `lower(btrim("${column}"::text))${
              kind === 'account' ? '=$1' : '=ANY($2::text[])'
            }`
        )
        .join(' OR ');
      const rows = await manager.query(
        `SELECT count(*)::text AS count FROM "${table}" WHERE (${where}) AND $1::text IS NOT NULL AND $2::text[] IS NOT NULL`,
        [account, profiles]
      );
      const raw = rows?.[0]?.count;
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        typeof raw !== 'string' ||
        !/^\d+$/.test(raw) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) > 10000
      )
        throw Error('SOCIAL_DELETION_ROW_BOUND');
      remaining += Number(raw);
    }
    return remaining;
  }
  async execute(
    value: unknown,
    action: AccountDeletionAction
  ): Promise<{ verified: true; remaining: number }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'social' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('SOCIAL_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const verified = await this.authority.validate(grant, 'social', action);
    const scope = verified.scope;
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('SOCIAL_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds];
    const assertScope = async () => {
      const fresh = await this.authority.validate(grant, 'social', action);
      if (JSON.stringify(fresh.scope) !== JSON.stringify(scope))
        throw Error('SOCIAL_DELETION_SCOPE_CHANGED');
    };
    let remaining = await this.database.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout='5s'");
      await manager.query("SET LOCAL statement_timeout='12s'");
      await this.catalog(manager);
      await installDeletionWriteFence(manager, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await manager.query(
        "SELECT set_config('ot.deletion_operation',$1,true)",
        [grant.operationId]
      );
      await assertScope();
      await this.counts(manager, grant.accountId, profiles);
      if (action === 'erase') {
        const plan = await this.content.inspect(
          manager,
          grant.accountId,
          profiles
        );
        await this.state.inspect(manager, grant.accountId, profiles);
        await this.related.inspect(manager, grant.accountId, profiles);
        await this.state.erase(manager, grant.accountId, profiles);
        await this.related.erase(manager, grant.accountId, profiles, plan);
        await this.content.erase(manager, grant.accountId, profiles);
      }
      return this.counts(manager, grant.accountId, profiles);
    });
    // Drain volatile work only after the permanent producer fence has committed.
    await this.notifications.cancelPendingForProfiles(profiles);
    if (action === 'erase') {
      const receipt = await this.audit.eraseParticipation(
        { accountId: grant.accountId, profileIds: profiles },
        grant.operationId
      );
      if (!receipt.allDeclaredSourcesVerified)
        throw Error('SOCIAL_DELETION_AUDIT_UNVERIFIED');
    }
    if (action !== 'fence') {
      remaining = await this.database.transaction(async (manager) => {
        await manager.query("SET LOCAL statement_timeout='12s'");
        await this.content.readback(manager, grant.accountId, profiles);
        await this.state.readback(manager, grant.accountId, profiles);
        await this.related.readback(manager, grant.accountId, profiles);
        return this.counts(manager, grant.accountId, profiles);
      });
      if (remaining) throw Error('SOCIAL_DELETION_READBACK_NONEMPTY');
    }
    await assertScope();
    return { verified: true, remaining };
  }
}
