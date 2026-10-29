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
import { validatePaymentsDispositions } from './payments-account-export-dispositions';
import { PAYMENT_DELETION_IDENTITIES } from './account-deletion-policy';
const LIMIT = 10000;
@Injectable()
export class PaymentsAccountDeletionOwnerService {
  constructor(
    @Inject('PAYMENTS_CONNECTION') private readonly db: DataSource,
    private readonly authority: AccountDeletionAuthorityClient
  ) {}
  private async count(m: EntityManager, account: string, profiles: string[]) {
    let total = 0;
    for (const [table, fields] of Object.entries(PAYMENT_DELETION_IDENTITIES)) {
      const predicate =
        table === 'business_themes'
          ? `EXISTS(SELECT 1 FROM business_pages p WHERE p.id=t."businessPageId" AND p."ownerId"::text=$1)`
          : fields
              .map(
                ([c, k]) =>
                  `t."${c}"::text${
                    k === 'account' ? '=$1' : '=ANY($2::text[])'
                  }`
              )
              .join(' OR ');
      const rows = await m.query(
        `SELECT count(*)::text n FROM "${table}" t WHERE ${predicate}`,
        [
          account,
          ...(fields.some(([, k]) => k === 'profile') ? [profiles] : []),
        ]
      );
      if (
        rows?.length !== 1 ||
        typeof rows[0].n !== 'string' ||
        !/^\d+$/.test(rows[0].n) ||
        !Number.isSafeInteger(Number(rows[0].n)) ||
        Number(rows[0].n) > LIMIT
      )
        throw Error('PAYMENTS_DELETION_ROW_BOUND');
      total += Number(rows[0].n);
    }
    return total;
  }
  private async inspect(m: EntityManager, account: string, p: string[]) {
    const bad = await m.query(
      'SELECT id FROM donations WHERE ("userId"::text=$1 OR "profileId"::text=ANY($2::text[])) AND ("userId"::text IS DISTINCT FROM $1 OR ("profileId" IS NOT NULL AND NOT("profileId"::text=ANY($2::text[])))) LIMIT 1',
      [account, p]
    );
    if (bad.length) throw Error('PAYMENTS_DELETION_BINDING_CONFLICT');
    const badTheme = await m.query(
      'SELECT p.id FROM business_pages p JOIN business_themes t ON t.id=p."businessThemeId" WHERE p."ownerId"::text=$1 AND t."businessPageId"<>p.id LIMIT 1',
      [account]
    );
    if (badTheme.length) throw Error('PAYMENTS_DELETION_PARENT_CONFLICT');
  }
  async execute(value: unknown, action: AccountDeletionAction) {
    if (
      !validateDeletionGrantShape(value) ||
      value.owner !== 'payments' ||
      value.action !== action ||
      !['fence', 'erase', 'readback'].includes(action)
    )
      throw Error('PAYMENTS_DELETION_GRANT_INVALID');
    const grant = Object.freeze({ ...value });
    const { scope } = await this.authority.validate(grant, 'payments', action);
    if (
      !scope ||
      !validateDeletionIdentityDomains(scope) ||
      scope.currentProfileIds.length > 999 ||
      scope.legacyProfileIds.length
    )
      throw Error('PAYMENTS_DELETION_SCOPE_INVALID');
    const profiles = [...scope.currentProfileIds];
    const fresh = async () => {
      if (
        JSON.stringify(
          (await this.authority.validate(grant, 'payments', action)).scope
        ) !== JSON.stringify(scope)
      )
        throw Error('PAYMENTS_DELETION_SCOPE_CHANGED');
    };
    const remaining = await this.db.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout='5s'");
      await m.query("SET LOCAL statement_timeout='12s'");
      if (
        validatePaymentsDispositions(
          this.db.entityMetadatas.map((e) => e.target)
        ).length
      )
        throw Error('PAYMENTS_DELETION_METADATA_DRIFT');
      const physical = await m.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema=current_schema() GROUP BY table_name`
      );
      const expected = new Map(
        this.db.entityMetadatas.map((e) => [
          e.tableName,
          e.columns.map((c) => c.databaseName).sort(),
        ])
      );
      expected.set('migrations', ['id', 'name', 'timestamp']);
      if (
        physical.length !== expected.size ||
        physical.some(
          (r) =>
            JSON.stringify([...r.columns].sort()) !==
            JSON.stringify(expected.get(r.table))
        )
      )
        throw Error('PAYMENTS_DELETION_CATALOG_DRIFT');
      await installDeletionWriteFence(m, grant.operationId, [
        { kind: 'account', id: grant.accountId },
        ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ]);
      await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
        grant.operationId,
      ]);
      await fresh();
      await this.count(m, grant.accountId, profiles);
      await this.inspect(m, grant.accountId, profiles);
      if (action === 'erase') {
        const a = grant.accountId;
        const selectedPayments = await m.query(
          'SELECT id FROM classified_payments WHERE "buyerId"::text=$1 OR "sellerId"::text=$1',
          [a]
        );
        const selectedOffers = await m.query(
          'SELECT id FROM offers WHERE "buyerId"::text=$1 OR "sellerId"::text=$1',
          [a]
        );
        const nil = DELETED_ACCOUNT_ID;
        // Single-account records: delete credentials, balances and owned payload together.
        for (const [t, c] of [
          ['donations', 'userId'],
          ['seller_wallets', 'sellerId'],
          ['payment_events', 'userId'],
          ['community_sponsorships', 'userId'],
        ] as const)
          await m.query(`DELETE FROM "${t}" WHERE "${c}"::text=$1`, [a]);
        await m.query('DELETE FROM payout_requests WHERE "sellerId"::text=$1', [
          a,
        ]);
        await m.query(
          'UPDATE payout_requests SET "processedBy"=NULL,"rejectionReason"=NULL WHERE "processedBy"::text=$1',
          [a]
        );
        // Shared financial facts stay available to the counterpart. Remove only matching participation and private transaction context.
        await m.query(
          `UPDATE classified_payments SET "buyerId"=CASE WHEN "buyerId"::text=$1 THEN $2::uuid ELSE "buyerId" END,"sellerId"=CASE WHEN "sellerId"::text=$1 THEN $2::uuid ELSE "sellerId" END,"interestedBuyerId"=CASE WHEN "interestedBuyerId"::text=$1 THEN NULL ELSE "interestedBuyerId" END,"paymentIntentId"=CASE WHEN "buyerId"::text=$1 THEN NULL ELSE "paymentIntentId" END,"LemonSqueezyOrderId"=CASE WHEN "buyerId"::text=$1 THEN NULL ELSE "LemonSqueezyOrderId" END,"proofImageUrl"=CASE WHEN "buyerId"::text=$1 THEN NULL ELSE "proofImageUrl" END,"disputeReason"=CASE WHEN "buyerId"::text=$1 OR "sellerId"::text=$1 THEN NULL ELSE "disputeReason" END WHERE "buyerId"::text=$1 OR "sellerId"::text=$1 OR "interestedBuyerId"::text=$1`,
          [a, nil]
        );
        await m.query(
          `DELETE FROM classified_payments WHERE id=ANY($2::uuid[]) AND "buyerId"=$1::uuid AND COALESCE("sellerId",$1::uuid)=$1::uuid AND "interestedBuyerId" IS NULL`,
          [nil, selectedPayments.map((r) => r.id)]
        );
        await m.query(
          `UPDATE offers SET "buyerId"=CASE WHEN "buyerId"::text=$1 THEN $2::uuid ELSE "buyerId" END,"sellerId"=CASE WHEN "sellerId"::text=$1 THEN $2::uuid ELSE "sellerId" END,message=CASE WHEN "buyerId"::text=$1 THEN NULL ELSE message END,"counterMessage"=CASE WHEN "sellerId"::text=$1 THEN NULL ELSE "counterMessage" END,"counterOfferAmount"=CASE WHEN "sellerId"::text=$1 THEN NULL ELSE "counterOfferAmount" END WHERE "buyerId"::text=$1 OR "sellerId"::text=$1`,
          [a, nil]
        );
        await m.query(
          'DELETE FROM offers WHERE id=ANY($2::uuid[]) AND "buyerId"=$1::uuid AND "sellerId"=$1::uuid',
          [nil, selectedOffers.map((r) => r.id)]
        );
        await m.query(
          'DELETE FROM business_themes t USING business_pages p WHERE p.id=t."businessPageId" AND p."ownerId"::text=$1',
          [a]
        );
        await m.query(
          `UPDATE business_pages SET "ownerId"=$2::uuid,name='Deleted account business',description=NULL,"logoUrl"=NULL,website=NULL,phone=NULL,email=NULL,address=NULL,"lemonSqueezySubscriptionId"=NULL,"subscriptionStatus"='cancelled',"pinnedPostId"=NULL,"customSpotContent"=NULL,"customSpotImageUrl"=NULL,"customSpotGradient"=NULL,"businessThemeId"=NULL,"isFeatured"=false,"featuredSpotType"=NULL WHERE "ownerId"::text=$1`,
          [a, nil]
        );
      }
      const n = await this.count(m, grant.accountId, profiles);
      if (action !== 'fence' && n)
        throw Error('PAYMENTS_DELETION_READBACK_NONEMPTY');
      return n;
    });
    await fresh();
    return { verified: true as const, remaining };
  }
}
