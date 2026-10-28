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
import { validateChatDispositions } from './chat-account-export-dispositions';
const LIMIT = 10000;
const own = (col: string) => `lower(btrim(${col}))=ANY($1::text[])`;
const has = (col: string) =>
  `EXISTS(SELECT 1 FROM unnest(${col}) v WHERE lower(btrim(v))=ANY($1::text[]))`;
@Injectable()
export class ChatAccountDeletionOwnerService {
  constructor(
    @Inject('CHAT_COLLECTOR_CONNECTION') private readonly db: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}
  private async counts(m: EntityManager, p: string[]) {
    const result: Record<string, number> = {};
    for (const [t, predicate] of Object.entries({
      conversation: `${own('"ownerId"')} OR ${has('participants')}`,
      message: `${own('"senderId"')} OR ${has('recipients')}`,
    })) {
      const rows = await m.query(
        `SELECT count(*)::text n FROM "${t}" WHERE ${predicate}`,
        [p]
      );
      if (
        rows?.length !== 1 ||
        typeof rows[0].n !== 'string' ||
        !/^\d+$/.test(rows[0].n) ||
        !Number.isSafeInteger(Number(rows[0].n)) ||
        Number(rows[0].n) > LIMIT
      )
        throw Error('CHAT_DELETION_ROW_BOUND');
      result[t] = Number(rows[0].n);
    }
    return Object.values(result).reduce((a, b) => a + b, 0);
  }
  async execute(value: unknown, action: AccountDeletionAction) {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'chat-collector' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('CHAT_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const { scope } = await this.authority.validate(
      grant,
      'chat-collector',
      action
    );
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('CHAT_DELETION_SCOPE_INVALID');
    const p = [...scope.currentProfileIds];
    const fresh = async () => {
      if (
        JSON.stringify(
          (await this.authority.validate(grant, 'chat-collector', action)).scope
        ) !== JSON.stringify(scope)
      )
        throw Error('CHAT_DELETION_SCOPE_CHANGED');
    };
    const remaining = await this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout='5s'");
      await m.query("SET LOCAL statement_timeout='12s'");
      const catalog = await m.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name`
      );
      if (
        validateChatDispositions(this.db.entityMetadatas, undefined, catalog)
          .length
      )
        throw Error('CHAT_DELETION_CATALOG_DRIFT');
      // Account-domain values in the legacy owner column are ambiguous, never attributed as profiles.
      const ambiguous = await m.query(
        'SELECT id FROM conversation WHERE lower(btrim("ownerId"))=$1 LIMIT 1',
        [grant.accountId]
      );
      if (ambiguous.length)
        throw Error('CHAT_DELETION_AMBIGUOUS_ACCOUNT_OWNER');
      await installDeletionWriteFence(m, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...p.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
        grant.operationId,
      ]);
      await fresh();
      await this.counts(m, p);
      if (action === 'erase') {
        await m.query(`DELETE FROM message WHERE ${own('"senderId"')}`, [p]);
        await m.query(
          `UPDATE message SET recipients=ARRAY(SELECT DISTINCT CASE WHEN lower(btrim(v))=ANY($1::text[]) THEN $2::text ELSE v END FROM unnest(recipients) v) WHERE ${has(
            'recipients'
          )}`,
          [p, DELETED_ACCOUNT_ID]
        );
        // Preserve counterpart messages and the stable conversation container. No source traversal.
        await m.query(
          `UPDATE conversation SET title=CASE WHEN ${own(
            '"ownerId"'
          )} OR type='direct' THEN 'Deleted account conversation' ELSE title END,"ownerId"=CASE WHEN ${own(
            '"ownerId"'
          )} THEN $2::text ELSE "ownerId" END,participants=ARRAY(SELECT DISTINCT CASE WHEN lower(btrim(v))=ANY($1::text[]) THEN $2::text ELSE v END FROM unnest(participants) v) WHERE ${own(
            '"ownerId"'
          )} OR ${has('participants')}`,
          [p, DELETED_ACCOUNT_ID]
        );
      }
      const n = await this.counts(m, p);
      if (action !== 'fence' && n)
        throw Error('CHAT_DELETION_READBACK_NONEMPTY');
      return n;
    });
    await fresh();
    return { verified: true as const, remaining };
  }
}
