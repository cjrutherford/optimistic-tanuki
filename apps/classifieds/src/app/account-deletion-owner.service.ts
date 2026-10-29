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
import { validateClassifiedsDispositions } from './classifieds-account-export-dispositions';
const LIMIT = 10000;
const predicate = `("appScope" IN ('client-interface','local-hub')) AND ("userId"::text=$1 OR "profileId"::text=ANY($2::text[]))`;
@Injectable()
export class ClassifiedsAccountDeletionOwnerService {
  constructor(
    @Inject('CLASSIFIEDS_CONNECTION') private readonly db: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}
  private async counts(m: EntityManager, account: string, p: string[]) {
    const rows = await m.query(
      `SELECT id,"userId","profileId" FROM classified_ad WHERE ${predicate} ORDER BY id LIMIT ${
        LIMIT + 1
      }`,
      [account, p]
    );
    if (!Array.isArray(rows) || rows.length > LIMIT)
      throw Error('CLASSIFIEDS_DELETION_ROW_BOUND');
    if (rows.some((r) => r.userId !== account || !p.includes(r.profileId)))
      throw Error('CLASSIFIEDS_DELETION_BINDING_CONFLICT');
    return rows.length;
  }
  async execute(value: unknown, action: AccountDeletionAction) {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'classifieds' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('CLASSIFIEDS_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const { scope } = await this.authority.validate(
      grant,
      'classifieds',
      action
    );
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('CLASSIFIEDS_DELETION_SCOPE_INVALID');
    const p = [...scope.currentProfileIds];
    const fresh = async () => {
      if (
        JSON.stringify(
          (await this.authority.validate(grant, 'classifieds', action)).scope
        ) !== JSON.stringify(scope)
      )
        throw Error('CLASSIFIEDS_DELETION_SCOPE_CHANGED');
    };
    const remaining = await this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout='5s'");
      await m.query("SET LOCAL statement_timeout='12s'");
      const catalog = await m.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name`
      );
      if (
        validateClassifiedsDispositions(
          this.db.entityMetadatas,
          undefined,
          catalog
        ).length
      )
        throw Error('CLASSIFIEDS_DELETION_CATALOG_DRIFT');
      await installDeletionWriteFence(m, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...p.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
        grant.operationId,
      ]);
      await fresh();
      await this.counts(m, grant.accountId, p);
      if (action === 'erase')
        await m.query(`DELETE FROM classified_ad WHERE ${predicate}`, [
          grant.accountId,
          p,
        ]);
      const n = await this.counts(m, grant.accountId, p);
      if (action !== 'fence' && n)
        throw Error('CLASSIFIEDS_DELETION_READBACK_NONEMPTY');
      return n;
    });
    await fresh();
    return { verified: true as const, remaining };
  }
}
