import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
export const PAYMENT_DELETION_IDENTITIES: Readonly<
  Record<string, readonly (readonly [string, 'account' | 'profile'])[]>
> = {
  donations: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  classified_payments: [
    ['buyerId', 'account'],
    ['sellerId', 'account'],
    ['interestedBuyerId', 'account'],
  ],
  seller_wallets: [['sellerId', 'account']],
  payment_events: [['userId', 'account']],
  offers: [
    ['buyerId', 'account'],
    ['sellerId', 'account'],
  ],
  payout_requests: [
    ['sellerId', 'account'],
    ['processedBy', 'account'],
  ],
  business_pages: [['ownerId', 'account']],
  community_sponsorships: [['userId', 'account']],
  business_themes: [],
};
export function paymentsDeletionFenceSql() {
  const shared = generateDeletionWriteFenceSql([]);
  const cases = Object.entries(PAYMENT_DELETION_IDENTITIES)
    .map(
      ([t, fields]) =>
        `WHEN '${t}' THEN RETURN ARRAY[${fields
          .map(([c, k]) => `ot_deletion_fence_key(b->>'${c}','${k}')`)
          .join(',')}]::text[];`
    )
    .join('\n');
  const sql = `CREATE FUNCTION ot_payments_keys(t text,b jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$ BEGIN CASE t ${cases} ELSE RAISE EXCEPTION 'PAYMENTS_DELETION_UNKNOWN_TABLE';END CASE;END $ot$;
 CREATE FUNCTION ot_payments_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
 DECLARE sides jsonb[]:=ARRAY[]::jsonb[];b jsonb;p jsonb;keys text[]:=ARRAY[]::text[];k text;hit text;ops text[]:=ARRAY[]::text[];op text:=NULLIF(current_setting('ot.deletion_operation',true),'');col text;oldbody jsonb; BEGIN
 IF TG_OP<>'INSERT' THEN oldbody:=to_jsonb(OLD);sides:=array_append(sides,oldbody);END IF;IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW));END IF;
 FOREACH b IN ARRAY sides LOOP
 keys:=keys||ot_payments_keys(TG_TABLE_NAME,b);
 IF TG_TABLE_NAME='business_themes' THEN SELECT to_jsonb(v) INTO p FROM business_pages v WHERE v.id::text=b->>'businessPageId' FOR SHARE;
 IF p IS NOT NULL THEN keys:=keys||ot_payments_keys('business_pages',p);IF op IS NULL AND p->>'ownerId'='00000000-0000-0000-0000-000000000000' AND TG_OP<>'DELETE' THEN RAISE EXCEPTION 'PAYMENTS_DELETED_CONTAINER';END IF;END IF;END IF;
 IF TG_TABLE_NAME='classified_payments' AND b->>'offerId' IS NOT NULL THEN SELECT to_jsonb(v) INTO p FROM offers v WHERE v.id::text=b->>'offerId' FOR SHARE;IF p IS NOT NULL THEN keys:=keys||ot_payments_keys('offers',p);END IF;END IF;
 END LOOP;
 IF op IS NULL AND TG_OP<>'DELETE' THEN
  FOREACH col IN ARRAY CASE TG_TABLE_NAME WHEN 'classified_payments' THEN ARRAY['buyerId','sellerId'] WHEN 'offers' THEN ARRAY['buyerId','sellerId'] WHEN 'business_pages' THEN ARRAY['ownerId'] ELSE ARRAY[]::text[] END LOOP
   IF (TG_OP='INSERT' AND to_jsonb(NEW)->>col='00000000-0000-0000-0000-000000000000') OR (TG_OP='UPDATE' AND oldbody->>col='00000000-0000-0000-0000-000000000000' AND (to_jsonb(NEW)->>col IS DISTINCT FROM oldbody->>col OR TG_TABLE_NAME='business_pages')) THEN RAISE EXCEPTION 'PAYMENTS_DELETED_PARTICIPATION';END IF;
  END LOOP;
 END IF;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;
 IF cardinality(ops)>0 AND(op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;`;
  const tables = Object.keys(PAYMENT_DELETION_IDENTITIES);
  return {
    up: [
      ...shared.up,
      sql,
      ...tables.map(
        (t) =>
          `CREATE TRIGGER ot_payments_deletion_${t} BEFORE INSERT OR UPDATE OR DELETE ON "${t}" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();`
      ),
    ],
    down: [
      ...tables.map(
        (t) => `DROP TRIGGER IF EXISTS ot_payments_deletion_${t} ON "${t}";`
      ),
      'DROP FUNCTION IF EXISTS ot_payments_deletion_guard();',
      'DROP FUNCTION IF EXISTS ot_payments_keys(text,jsonb);',
      ...shared.down,
    ],
  };
}
