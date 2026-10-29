import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AccountDeletionAction,
  DELETED_ACCOUNT_ID,
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  installDeletionWriteFence,
} from '@optimistic-tanuki/storage';
import { validateWorkspaceDispositions } from './workspace-account-export-dispositions';
import inventory from './workspace-account-export-dispositions.json';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
@Injectable()
export class WorkspaceAccountDeletionOwnerService {
  constructor(
    @Inject('WORKSPACE_CONNECTION') private readonly database: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}
  private async rows(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    const rows = await manager.query(
      'SELECT id,"ownerUserId","ownerProfileId","sourceService","sourceId" FROM workspaces WHERE "ownerUserId"=$1::uuid OR "ownerProfileId"=ANY($2::uuid[]) OR ("sourceService"=\'app-configurator\' AND "sourceId"=ANY($2::uuid[])) ORDER BY id LIMIT 10001',
      [account, profiles]
    );
    if (
      !Array.isArray(rows) ||
      rows.length > 10000 ||
      rows.some((row) => !UUID.test(row?.id))
    )
      throw Error('WORKSPACE_DELETION_READBACK_INVALID');
    for (const row of rows)
      if (row.ownerUserId !== account || !profiles.includes(row.ownerProfileId))
        throw Error('WORKSPACE_DELETION_BINDING_CONFLICT');
    return rows as {
      id: string;
      ownerUserId: string;
      ownerProfileId: string;
      sourceService: string;
      sourceId: string;
    }[];
  }
  async execute(
    value: unknown,
    action: AccountDeletionAction
  ): Promise<{ verified: true; remaining: number }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'workspace' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('WORKSPACE_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const { scope } = await this.authority.validate(grant, 'workspace', action);
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('WORKSPACE_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds];
    const fresh = async () => {
      if (
        JSON.stringify(
          (await this.authority.validate(grant, 'workspace', action)).scope
        ) !== JSON.stringify(scope)
      )
        throw Error('WORKSPACE_DELETION_SCOPE_CHANGED');
    };
    const remaining = await this.database.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout='5s'");
      await manager.query("SET LOCAL statement_timeout='12s'");
      const catalog = await manager.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name`
      );
      if (
        validateWorkspaceDispositions(
          this.database.entityMetadatas,
          inventory,
          catalog
        ).length
      )
        throw Error('WORKSPACE_DELETION_CATALOG_DRIFT');
      await installDeletionWriteFence(manager, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await manager.query(
        "SELECT set_config('ot.deletion_operation',$1,true)",
        [grant.operationId]
      );
      await fresh();
      const rows = await this.rows(manager, grant.accountId, profiles);
      // Stewardship is not exclusive source-content ownership. Keep the registration, routing and source container.
      if (action === 'erase')
        await manager.query(
          'UPDATE workspaces SET slug=\'deleted-\'||id::text,"displayName"=\'Deleted account workspace\',"ownerUserId"=$3::uuid,"ownerProfileId"=$3::uuid,"sourceId"=CASE WHEN "sourceService"=\'app-configurator\' AND "sourceId"=ANY($2::uuid[]) THEN $3::uuid ELSE "sourceId" END WHERE "ownerUserId"=$1::uuid AND "ownerProfileId"=ANY($2::uuid[])',
          [grant.accountId, profiles, DELETED_ACCOUNT_ID]
        );
      const readback = await this.rows(manager, grant.accountId, profiles);
      if (action !== 'fence' && readback.length)
        throw Error('WORKSPACE_DELETION_READBACK_NONEMPTY');
      return action === 'fence' ? rows.length : readback.length;
    });
    await fresh();
    return { verified: true, remaining };
  }
}
