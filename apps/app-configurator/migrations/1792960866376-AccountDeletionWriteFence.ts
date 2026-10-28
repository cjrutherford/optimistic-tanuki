import { MigrationInterface, QueryRunner } from 'typeorm';
// Owning CLI-generated fence table and frozen reviewed producer SQL; composite parent FKs unchanged.
export class AccountDeletionWriteFence1792960866376
  implements MigrationInterface
{
  name = 'AccountDeletionWriteFence1792960866376';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "account_deletion_write_fence" ("key" character varying(64) NOT NULL, "kind" character varying(24) NOT NULL, "operationId" uuid NOT NULL, "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60a9ab88c38291fb14c1a8a44ad" PRIMARY KEY ("key"))'
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT \"operationId\"::text INTO raw_value FROM account_deletion_write_fence WHERE \"key\" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;"
    );
    await queryRunner.query(
      "CREATE FUNCTION ot_app_configurator_identity_keys(t text,body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$ BEGIN CASE t WHEN 'app_configuration_entity' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'ownerUserId'),'account'),ot_deletion_fence_key(btrim(body->>'ownerProfileId'),'profile')]::text[];\nWHEN 'app_instances' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'ownerUserId'),'account'),ot_deletion_fence_key(btrim(body->>'ownerProfileId'),'profile')]::text[];\nWHEN 'app_memberships' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[]; ELSE RAISE EXCEPTION 'APP_CONFIGURATOR_DELETION_UNKNOWN_TABLE';END CASE;END $ot$;\n CREATE FUNCTION ot_app_configurator_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\n DECLARE body jsonb;ref jsonb;sides jsonb[]:=ARRAY[]::jsonb[];keys text[]:=ARRAY[]::text[];k text;hit text;ops text[]:=ARRAY[]::text[];op text:=NULLIF(current_setting('ot.deletion_operation',true),'');\n BEGIN\n IF TG_OP<>'INSERT' THEN sides:=array_append(sides,to_jsonb(OLD));END IF;IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW));END IF;\n FOREACH body IN ARRAY sides LOOP\n  IF op IS NULL AND TG_TABLE_NAME='app_instances' AND (body->>'ownerUserId'='00000000-0000-0000-0000-000000000000' OR body->>'ownerProfileId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'APP_CONFIGURATOR_DELETED_STEWARDSHIP';END IF;\n  keys:=keys||ot_app_configurator_identity_keys(TG_TABLE_NAME,body);\n  IF TG_TABLE_NAME IN ('app_configuration_entity','app_memberships') THEN\n   SELECT to_jsonb(p) INTO ref FROM app_instances p WHERE p.id::text=lower(btrim(body->>'appInstanceId')) AND p.\"workspaceId\"::text=lower(btrim(body->>'workspaceId')) AND p.\"appScope\"=body->>'appScope' FOR SHARE;\n   IF ref IS NOT NULL THEN keys:=keys||ot_app_configurator_identity_keys('app_instances',ref);\n    IF op IS NULL AND TG_OP<>'DELETE' AND TG_TABLE_NAME='app_configuration_entity' AND (ref->>'ownerUserId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerProfileId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'APP_CONFIGURATOR_DELETED_CONFIGURATION';END IF;\n   END IF;\n  END IF;\n END LOOP;\n FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT \"operationId\"::text INTO hit FROM account_deletion_write_fence WHERE \"key\"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;\n IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;"
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_app_configurator_deletion_app_configuration_entity BEFORE INSERT OR UPDATE OR DELETE ON "app_configuration_entity" FOR EACH ROW EXECUTE FUNCTION ot_app_configurator_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_app_configurator_deletion_app_instances BEFORE INSERT OR UPDATE OR DELETE ON "app_instances" FOR EACH ROW EXECUTE FUNCTION ot_app_configurator_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_app_configurator_deletion_app_memberships BEFORE INSERT OR UPDATE OR DELETE ON "app_memberships" FOR EACH ROW EXECUTE FUNCTION ot_app_configurator_deletion_guard();'
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_app_configurator_deletion_app_configuration_entity ON "app_configuration_entity";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_app_configurator_deletion_app_instances ON "app_instances";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_app_configurator_deletion_app_memberships ON "app_memberships";'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_app_configurator_deletion_guard();'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_app_configurator_identity_keys(text,jsonb);'
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
    await queryRunner.query('DROP TABLE "account_deletion_write_fence"');
  }
}
