import { MigrationInterface, QueryRunner } from 'typeorm';
// Owning Nx-generated schema; reviewed, frozen non-ORM write invariants follow.
export class AccountDeletionControl1792886267140 implements MigrationInterface {
  name = 'AccountDeletionControl1792886267140';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "account_deletion_operations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "accountId" uuid, "fenceKey" character varying(64) NOT NULL, "appId" character varying NOT NULL, "state" character varying NOT NULL, "idempotencyKey" uuid NOT NULL, "attempt" integer NOT NULL DEFAULT \'0\', "leaseOwner" uuid, "leaseExpiresAt" TIMESTAMP WITH TIME ZONE, "privateScope" jsonb, "ownerProgress" jsonb NOT NULL DEFAULT \'{}\'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f5a768521145cee188ed7371d36" PRIMARY KEY ("id"))'
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_account_deletion_operations_fenceKey" ON "account_deletion_operations" ("fenceKey") '
    );
    await queryRunner.query(
      'CREATE TABLE "account_deletion_write_fence" ("key" character varying(64) NOT NULL, "kind" character varying(24) NOT NULL, "operationId" uuid NOT NULL, "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60a9ab88c38291fb14c1a8a44ad" PRIMARY KEY ("key"))'
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT \"operationId\"::text INTO raw_value FROM account_deletion_write_fence WHERE \"key\" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_user_entity\" BEFORE INSERT OR UPDATE OR DELETE ON \"user_entity\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('id', 'account', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_token\" BEFORE INSERT OR UPDATE OR DELETE ON \"token\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('userId', 'account', 'scalar', 'profileId', 'profile', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_oauth_provider\" BEFORE INSERT OR UPDATE OR DELETE ON \"oauth_provider\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('userId', 'account', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_key_datum\" BEFORE INSERT OR UPDATE OR DELETE ON \"key_datum\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('userId', 'account', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_auth_action_token\" BEFORE INSERT OR UPDATE OR DELETE ON \"auth_action_token\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('userId', 'account', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_guardian_permission\" BEFORE INSERT OR UPDATE OR DELETE ON \"guardian_permission\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('userId', 'account', 'scalar', 'guardianUserId', 'account', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_guardian_policy_notice\" BEFORE INSERT OR UPDATE OR DELETE ON \"guardian_policy_notice\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('guardianUserId', 'account', 'scalar');"
    );
    await queryRunner.query(
      "CREATE TRIGGER \"ot_deletion_write_fence_account_export_jobs\" BEFORE INSERT OR UPDATE OR DELETE ON \"account_export_jobs\" FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard('accountId', 'account', 'scalar');"
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_account_export_jobs" ON "account_export_jobs";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_guardian_policy_notice" ON "guardian_policy_notice";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_guardian_permission" ON "guardian_permission";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_auth_action_token" ON "auth_action_token";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_key_datum" ON "key_datum";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_oauth_provider" ON "oauth_provider";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_token" ON "token";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "ot_deletion_write_fence_user_entity" ON "user_entity";'
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
    await queryRunner.query(
      'DROP INDEX "public"."UQ_account_deletion_operations_fenceKey"'
    );
    await queryRunner.query('DROP TABLE "account_deletion_operations"');
  }
}
