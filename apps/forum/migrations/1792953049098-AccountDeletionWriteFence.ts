import { MigrationInterface, QueryRunner } from 'typeorm';
// Owning CLI-generated schema delta; frozen reviewed OLD/NEW and erased-context producer guard.
export class AccountDeletionWriteFence1792953049098
  implements MigrationInterface
{
  name = 'AccountDeletionWriteFence1792953049098';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "account_deletion_write_fence" ("key" character varying(64) NOT NULL, "kind" character varying(24) NOT NULL, "operationId" uuid NOT NULL, "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60a9ab88c38291fb14c1a8a44ad" PRIMARY KEY ("key"))'
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT \"operationId\"::text INTO raw_value FROM account_deletion_write_fence WHERE \"key\" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;"
    );
    await queryRunner.query(
      "CREATE FUNCTION ot_forum_identity_keys(t text,body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$ BEGIN CASE t WHEN 'topic' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'thread' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile'),ot_deletion_fence_key(btrim(body->>'moderatedBy'),'profile')]::text[];\nWHEN 'forum_post' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile'),ot_deletion_fence_key(btrim(body->>'moderatedBy'),'profile')]::text[];\nWHEN 'forum_report' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'reporterId'),'profile')]::text[];\nWHEN 'forum_moderation_action' THEN RETURN ARRAY[ot_deletion_fence_key(btrim(body->>'actorProfileId'),'profile')]::text[];\nWHEN 'forum_link' THEN RETURN ARRAY[]::text[];\nWHEN 'forum_post_links_forum_link' THEN RETURN ARRAY[]::text[]; ELSE RAISE EXCEPTION 'FORUM_DELETION_UNKNOWN_TABLE';END CASE;END $ot$;\n CREATE FUNCTION ot_forum_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\n DECLARE oldbody jsonb;newbody jsonb;side jsonb;ref jsonb;sides jsonb[]:=ARRAY[]::jsonb[];keys text[]:=ARRAY[]::text[];ops text[]:=ARRAY[]::text[];k text;hit text;parent_table text;parent_id text;op text:=NULLIF(current_setting('ot.deletion_operation',true),'');\n BEGIN\n IF TG_OP<>'INSERT' THEN oldbody:=to_jsonb(OLD);sides:=array_append(sides,oldbody);END IF;IF TG_OP<>'DELETE' THEN newbody:=to_jsonb(NEW);sides:=array_append(sides,newbody);END IF;\n IF op IS NULL AND TG_TABLE_NAME IN('topic','thread','forum_post') AND (oldbody->>'userId'='00000000-0000-0000-0000-000000000000' OR newbody->>'userId'='00000000-0000-0000-0000-000000000000') THEN\n  IF NOT(TG_TABLE_NAME='thread' AND TG_OP='UPDATE' AND (oldbody-ARRAY['viewCount','updatedAt'])=(newbody-ARRAY['viewCount','updatedAt'])) THEN RAISE EXCEPTION 'FORUM_DELETED_CONTAINER';END IF;\n END IF;\n IF op IS NULL AND TG_TABLE_NAME='forum_report' AND TG_OP<>'DELETE' AND (newbody->>'reporterId'='00000000-0000-0000-0000-000000000000' OR newbody->>'contentId'='00000000-0000-0000-0000-000000000000') AND (newbody->>'description' IS NOT NULL OR newbody->>'adminNotes' IS NOT NULL) THEN RAISE EXCEPTION 'FORUM_DELETED_CONTEXT';END IF;\n FOREACH side IN ARRAY sides LOOP\n  keys:=keys||ot_forum_identity_keys(TG_TABLE_NAME,side);\n  parent_table:=NULL;parent_id:=NULL;\n  IF TG_TABLE_NAME='thread' THEN parent_table:='topic';parent_id:=side->>'topicId';\n  ELSIF TG_TABLE_NAME='forum_post' THEN parent_table:='thread';parent_id:=side->>'threadId';\n  ELSIF TG_TABLE_NAME='forum_post_links_forum_link' THEN parent_table:='forum_post';parent_id:=side->>'forumPostId';\n  ELSIF TG_TABLE_NAME IN('forum_report','forum_moderation_action') THEN parent_table:=CASE COALESCE(side->>'contentType',side->>'subjectType') WHEN 'thread' THEN 'thread' WHEN 'post' THEN 'forum_post' END;parent_id:=COALESCE(side->>'contentId',side->>'subjectId');END IF;\n  IF parent_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1 FOR SHARE',parent_table) INTO ref USING lower(btrim(parent_id));IF ref IS NOT NULL THEN keys:=keys||ot_forum_identity_keys(parent_table,ref);IF op IS NULL AND TG_OP<>'DELETE' AND TG_TABLE_NAME IN ('forum_post_links_forum_link','forum_report','forum_moderation_action') AND ref->>'userId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'FORUM_DELETED_CONTAINER';END IF;END IF;END IF;\n  IF TG_TABLE_NAME='forum_link' THEN FOR ref IN SELECT to_jsonb(p) FROM forum_post p JOIN forum_post_links_forum_link j ON j.\"forumPostId\"=p.id WHERE j.\"forumLinkId\"::text=side->>'id' FOR SHARE OF p LOOP keys:=keys||ot_forum_identity_keys('forum_post',ref);END LOOP;END IF;\n  IF TG_TABLE_NAME='forum_moderation_action' AND side->>'action'='report_status' THEN SELECT to_jsonb(r) INTO ref FROM forum_report r WHERE r.id::text=side->'details'->>'reportId' FOR SHARE;IF ref IS NOT NULL THEN keys:=keys||ot_forum_identity_keys('forum_report',ref);IF op IS NULL AND TG_OP<>'DELETE' AND ref->>'reporterId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'FORUM_DELETED_CONTEXT';END IF;END IF;END IF;\n END LOOP;\n FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT \"operationId\"::text INTO hit FROM account_deletion_write_fence WHERE \"key\"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;\n IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;"
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_topic BEFORE INSERT OR UPDATE OR DELETE ON "topic" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_thread BEFORE INSERT OR UPDATE OR DELETE ON "thread" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_forum_post BEFORE INSERT OR UPDATE OR DELETE ON "forum_post" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_forum_report BEFORE INSERT OR UPDATE OR DELETE ON "forum_report" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_forum_moderation_action BEFORE INSERT OR UPDATE OR DELETE ON "forum_moderation_action" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_forum_link BEFORE INSERT OR UPDATE OR DELETE ON "forum_link" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_forum_deletion_forum_post_links_forum_link BEFORE INSERT OR UPDATE OR DELETE ON "forum_post_links_forum_link" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();'
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_topic ON "topic";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_thread ON "thread";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_forum_post ON "forum_post";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_forum_report ON "forum_report";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_forum_moderation_action ON "forum_moderation_action";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_forum_link ON "forum_link";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_forum_deletion_forum_post_links_forum_link ON "forum_post_links_forum_link";'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_forum_deletion_guard();'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_forum_identity_keys(text,jsonb);'
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
