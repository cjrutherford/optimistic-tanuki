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
import {
  validateAppConfiguratorDispositions,
  APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
} from './app-configurator-account-export-dispositions';
import { APP_CONFIGURATOR_DELETION_IDENTITIES } from './account-deletion-policy';
const LIMIT = 10000,
  UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonical = (v: unknown) =>
  typeof v === 'string' ? v.trim().toLowerCase() : '';
@Injectable()
export class AppConfiguratorAccountDeletionOwnerService {
  constructor(
    @Inject('APP-CONFIGURATOR_CONNECTION')
    private readonly database: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}
  private async candidates(
    manager: EntityManager,
    table: string,
    account: string,
    profiles: readonly string[]
  ) {
    const member = table === 'app_memberships',
      a = member ? 'userId' : 'ownerUserId',
      p = member ? 'profileId' : 'ownerProfileId';
    const rows = await manager.query(
      `SELECT id,"${a}"::text AS account,"${p}"::text AS profile,"workspaceId","appScope"${
        table === 'app_instances' ? '' : ',"appInstanceId"'
      } FROM "${table}" WHERE lower(btrim("${a}"::text))=$1 OR lower(btrim("${p}"::text))=ANY($2::text[]) ORDER BY id LIMIT ${
        LIMIT + 1
      }`,
      [account, profiles]
    );
    if (
      !Array.isArray(rows) ||
      rows.length > LIMIT ||
      rows.some((row) => !UUID.test(row?.id) || !UUID.test(row?.workspaceId))
    )
      throw Error('APP_CONFIGURATOR_DELETION_ROW_BOUND');
    if (
      rows.some(
        (row) =>
          canonical(row.account) !== account ||
          !profiles.includes(canonical(row.profile))
      )
    )
      throw Error('APP_CONFIGURATOR_DELETION_BINDING_CONFLICT');
    return rows as {
      id: string;
      account: string;
      profile: string;
      workspaceId: string;
      appScope: string;
      appInstanceId?: string;
    }[];
  }
  private async inspect(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    const configs = await this.candidates(
        manager,
        'app_configuration_entity',
        account,
        profiles
      ),
      instances = await this.candidates(
        manager,
        'app_instances',
        account,
        profiles
      ),
      memberships = await this.candidates(
        manager,
        'app_memberships',
        account,
        profiles
      );
    for (const [table, selected] of [
      ['app_configuration_entity', configs],
      ['app_memberships', memberships],
    ] as const) {
      const rows = await manager.query(
        `SELECT c.id,p.id AS parent,"p"."ownerUserId"::text AS account,"p"."ownerProfileId"::text AS profile FROM "${table}" c LEFT JOIN app_instances p ON c."appInstanceId"=p.id AND c."workspaceId"=p."workspaceId" AND c."appScope"=p."appScope" WHERE c.id=ANY($1::uuid[]) ORDER BY c.id`,
        [selected.map((r) => r.id)]
      );
      if (
        !Array.isArray(rows) ||
        rows.length !== selected.length ||
        rows.some((row) => !UUID.test(row?.parent))
      )
        throw Error('APP_CONFIGURATOR_DELETION_PARENT_UNVERIFIED');
      const bindings = new Map(selected.map((c) => [c.id, c]));
      if (
        table === 'app_configuration_entity' &&
        rows.some((row) => {
          const own = bindings.get(row.id);
          return (
            !own ||
            canonical(own.account) !== canonical(row.account) ||
            canonical(own.profile) !== canonical(row.profile)
          );
        })
      )
        throw Error('APP_CONFIGURATOR_DELETION_PARENT_BINDING_CONFLICT');
    }
    // A foreign configuration under an owned parent has unresolved historical attribution; never erase it by traversal.
    const unexpected = await manager.query(
      `SELECT c.id FROM app_configuration_entity c JOIN app_instances p ON c."appInstanceId"=p.id AND c."workspaceId"=p."workspaceId" AND c."appScope"=p."appScope" WHERE p.id=ANY($1::uuid[]) AND (lower(btrim(c."ownerUserId"))<>p."ownerUserId"::text OR lower(btrim(c."ownerProfileId"))<>p."ownerProfileId"::text) LIMIT ${
        LIMIT + 1
      }`,
      [instances.map((r) => r.id)]
    );
    if (!Array.isArray(unexpected) || unexpected.length)
      throw Error('APP_CONFIGURATOR_DELETION_PARENT_BINDING_CONFLICT');
    for (const table of ['app_memberships', 'app_configuration_entity']) {
      const rows = await manager.query(
        `SELECT count(*)::text AS n FROM "${table}" WHERE "appInstanceId"=ANY($1::uuid[])`,
        [instances.map((r) => r.id)]
      );
      const n = rows?.[0]?.n;
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        typeof n !== 'string' ||
        !/^\d+$/.test(n) ||
        !Number.isSafeInteger(Number(n)) ||
        Number(n) > LIMIT
      )
        throw Error('APP_CONFIGURATOR_DELETION_ROW_BOUND');
    }
    return { configs, instances, memberships };
  }
  private async counts(
    manager: EntityManager,
    account: string,
    profiles: readonly string[]
  ) {
    let remaining = 0;
    for (const [table, fields] of Object.entries(
      APP_CONFIGURATOR_DELETION_IDENTITIES
    )) {
      const predicate = fields
        .map(
          ([col, kind]) =>
            `lower(btrim("${col}"::text))${
              kind === 'account' ? '=$1' : '=ANY($2::text[])'
            }`
        )
        .join(' OR ');
      const rows = await manager.query(
        `SELECT count(*)::text AS n FROM "${table}" WHERE ${predicate}`,
        [account, profiles]
      );
      const n = rows?.[0]?.n;
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        typeof n !== 'string' ||
        !/^\d+$/.test(n) ||
        !Number.isSafeInteger(Number(n)) ||
        Number(n) > LIMIT
      )
        throw Error('APP_CONFIGURATOR_DELETION_READBACK_INVALID');
      remaining += Number(n);
    }
    return remaining;
  }
  async execute(
    value: unknown,
    action: AccountDeletionAction
  ): Promise<{ verified: true; remaining: number }> {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'app-configurator' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('APP_CONFIGURATOR_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const { scope } = await this.authority.validate(
      grant,
      'app-configurator',
      action
    );
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('APP_CONFIGURATOR_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds];
    const fresh = async () => {
      if (
        JSON.stringify(
          (await this.authority.validate(grant, 'app-configurator', action))
            .scope
        ) !== JSON.stringify(scope)
      )
        throw Error('APP_CONFIGURATOR_DELETION_SCOPE_CHANGED');
    };
    const remaining = await this.database.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout='5s'");
      await manager.query("SET LOCAL statement_timeout='12s'");
      const catalog = await manager.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name`
      );
      if (
        validateAppConfiguratorDispositions(
          this.database.entityMetadatas,
          APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
          catalog
        ).length
      )
        throw Error('APP_CONFIGURATOR_DELETION_CATALOG_DRIFT');
      await installDeletionWriteFence(manager, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await manager.query(
        "SELECT set_config('ot.deletion_operation',$1,true)",
        [grant.operationId]
      );
      await fresh();
      await this.counts(manager, grant.accountId, profiles);
      const selected = await this.inspect(manager, grant.accountId, profiles);
      if (action === 'erase') {
        await manager.query(
          'DELETE FROM app_configuration_entity WHERE id=ANY($1::uuid[])',
          [selected.configs.map((r) => r.id)]
        );
        await manager.query(
          'DELETE FROM app_memberships WHERE id=ANY($1::uuid[])',
          [selected.memberships.map((r) => r.id)]
        );
        const ids = selected.instances.map((r) => r.id);
        await manager.query(
          'UPDATE app_instances SET "ownerUserId"=$2::uuid,"ownerProfileId"=$2::uuid WHERE id=ANY($1::uuid[])',
          [ids, DELETED_ACCOUNT_ID]
        );
        await manager.query(
          'DELETE FROM app_instances p WHERE p.id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM app_memberships m WHERE m."appInstanceId"=p.id) AND NOT EXISTS(SELECT 1 FROM app_configuration_entity c WHERE c."appInstanceId"=p.id)',
          [ids]
        );
      }
      const remaining = await this.counts(manager, grant.accountId, profiles);
      if (action !== 'fence' && remaining)
        throw Error('APP_CONFIGURATOR_DELETION_READBACK_NONEMPTY');
      return remaining;
    });
    await fresh();
    return { verified: true, remaining };
  }
}
