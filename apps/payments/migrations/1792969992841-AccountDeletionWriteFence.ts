import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountDeletionWriteFence1792969992841
  implements MigrationInterface
{
  name = 'AccountDeletionWriteFence1792969992841';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "account_deletion_write_fence" ("key" character varying(64) NOT NULL, "kind" character varying(24) NOT NULL, "operationId" uuid NOT NULL, "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60a9ab88c38291fb14c1a8a44ad" PRIMARY KEY ("key"))`
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT \"operationId\"::text INTO raw_value FROM account_deletion_write_fence WHERE \"key\" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;"
    );
    await queryRunner.query(
      "CREATE FUNCTION ot_payments_keys(t text,b jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$ BEGIN CASE t WHEN 'donations' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'userId','account'),ot_deletion_fence_key(b->>'profileId','profile')]::text[];\nWHEN 'classified_payments' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'buyerId','account'),ot_deletion_fence_key(b->>'sellerId','account'),ot_deletion_fence_key(b->>'interestedBuyerId','account')]::text[];\nWHEN 'seller_wallets' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'sellerId','account')]::text[];\nWHEN 'payment_events' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'userId','account')]::text[];\nWHEN 'offers' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'buyerId','account'),ot_deletion_fence_key(b->>'sellerId','account')]::text[];\nWHEN 'payout_requests' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'sellerId','account'),ot_deletion_fence_key(b->>'processedBy','account')]::text[];\nWHEN 'business_pages' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'ownerId','account')]::text[];\nWHEN 'community_sponsorships' THEN RETURN ARRAY[ot_deletion_fence_key(b->>'userId','account')]::text[];\nWHEN 'business_themes' THEN RETURN ARRAY[]::text[]; ELSE RAISE EXCEPTION 'PAYMENTS_DELETION_UNKNOWN_TABLE';END CASE;END $ot$;\n CREATE FUNCTION ot_payments_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\n DECLARE sides jsonb[]:=ARRAY[]::jsonb[];b jsonb;p jsonb;keys text[]:=ARRAY[]::text[];k text;hit text;ops text[]:=ARRAY[]::text[];op text:=NULLIF(current_setting('ot.deletion_operation',true),'');col text;oldbody jsonb; BEGIN\n IF TG_OP<>'INSERT' THEN oldbody:=to_jsonb(OLD);sides:=array_append(sides,oldbody);END IF;IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW));END IF;\n FOREACH b IN ARRAY sides LOOP\n keys:=keys||ot_payments_keys(TG_TABLE_NAME,b);\n IF TG_TABLE_NAME='business_themes' THEN SELECT to_jsonb(v) INTO p FROM business_pages v WHERE v.id::text=b->>'businessPageId' FOR SHARE;\n IF p IS NOT NULL THEN keys:=keys||ot_payments_keys('business_pages',p);IF op IS NULL AND p->>'ownerId'='00000000-0000-0000-0000-000000000000' AND TG_OP<>'DELETE' THEN RAISE EXCEPTION 'PAYMENTS_DELETED_CONTAINER';END IF;END IF;END IF;\n IF TG_TABLE_NAME='classified_payments' AND b->>'offerId' IS NOT NULL THEN SELECT to_jsonb(v) INTO p FROM offers v WHERE v.id::text=b->>'offerId' FOR SHARE;IF p IS NOT NULL THEN keys:=keys||ot_payments_keys('offers',p);END IF;END IF;\n END LOOP;\n IF op IS NULL AND TG_OP<>'DELETE' THEN\n  FOREACH col IN ARRAY CASE TG_TABLE_NAME WHEN 'classified_payments' THEN ARRAY['buyerId','sellerId'] WHEN 'offers' THEN ARRAY['buyerId','sellerId'] WHEN 'business_pages' THEN ARRAY['ownerId'] ELSE ARRAY[]::text[] END LOOP\n   IF (TG_OP='INSERT' AND to_jsonb(NEW)->>col='00000000-0000-0000-0000-000000000000') OR (TG_OP='UPDATE' AND oldbody->>col='00000000-0000-0000-0000-000000000000' AND (to_jsonb(NEW)->>col IS DISTINCT FROM oldbody->>col OR TG_TABLE_NAME='business_pages')) THEN RAISE EXCEPTION 'PAYMENTS_DELETED_PARTICIPATION';END IF;\n  END LOOP;\n END IF;\n FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT \"operationId\"::text INTO hit FROM account_deletion_write_fence WHERE \"key\"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;\n IF cardinality(ops)>0 AND(op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;"
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_donations BEFORE INSERT OR UPDATE OR DELETE ON "donations" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_classified_payments BEFORE INSERT OR UPDATE OR DELETE ON "classified_payments" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_seller_wallets BEFORE INSERT OR UPDATE OR DELETE ON "seller_wallets" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_payment_events BEFORE INSERT OR UPDATE OR DELETE ON "payment_events" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_offers BEFORE INSERT OR UPDATE OR DELETE ON "offers" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_payout_requests BEFORE INSERT OR UPDATE OR DELETE ON "payout_requests" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_business_pages BEFORE INSERT OR UPDATE OR DELETE ON "business_pages" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_community_sponsorships BEFORE INSERT OR UPDATE OR DELETE ON "community_sponsorships" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_payments_deletion_business_themes BEFORE INSERT OR UPDATE OR DELETE ON "business_themes" FOR EACH ROW EXECUTE FUNCTION ot_payments_deletion_guard();'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_donations ON "donations";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_classified_payments ON "classified_payments";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_seller_wallets ON "seller_wallets";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_payment_events ON "payment_events";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_offers ON "offers";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_payout_requests ON "payout_requests";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_business_pages ON "business_pages";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_community_sponsorships ON "community_sponsorships";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_payments_deletion_business_themes ON "business_themes";'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_payments_deletion_guard();'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_payments_keys(text,jsonb);'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_deletion_fence_key(text, text);'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_collect_deletion_fence_keys(jsonb, text[]);'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_account_deletion_write_fence_guard();'
    );
    await queryRunner.query(`DROP TABLE "account_deletion_write_fence"`);
  }
}
