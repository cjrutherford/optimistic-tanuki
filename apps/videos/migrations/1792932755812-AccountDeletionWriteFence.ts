import { MigrationInterface, QueryRunner } from 'typeorm';
export class AccountDeletionWriteFence1792932755812
  implements MigrationInterface
{
  name = 'AccountDeletionWriteFence1792932755812';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "account_deletion_write_fence" ("key" character varying(64) NOT NULL, "kind" character varying(24) NOT NULL, "operationId" uuid NOT NULL, "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60a9ab88c38291fb14c1a8a44ad" PRIMARY KEY ("key"))'
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT \"operationId\"::text INTO raw_value FROM account_deletion_write_fence WHERE \"key\" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;"
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_videos_deletion_write_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; sides jsonb[]:=ARRAY[]::jsonb[]; parent jsonb; ref jsonb; parent_id uuid; item text; k text; keys text[]:=ARRAY[]::text[]; ops text[]:=ARRAY[]::text[]; hit text; op text:=NULLIF(current_setting('ot.deletion_operation',true),'');\nBEGIN\n IF TG_OP<>'INSERT' THEN sides:=array_append(sides,to_jsonb(OLD)); END IF;\n IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW)); END IF;\n FOREACH side IN ARRAY sides LOOP\n  IF TG_TABLE_NAME='channel' THEN\n   keys:=keys||ot_collect_deletion_fence_keys(side,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]);\n   IF (side->>'userId'='00000000-0000-0000-0000-000000000000' OR side->>'profileId'='00000000-0000-0000-0000-000000000000') AND op IS NULL THEN RAISE EXCEPTION 'VIDEO_DELETED_CONTAINER'; END IF;\n  ELSE\n   IF TG_TABLE_NAME IN ('video_view','channel_subscription') THEN keys:=keys||ot_collect_deletion_fence_keys(side,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;\n   IF TG_TABLE_NAME='live_session' THEN keys:=keys||ot_collect_deletion_fence_keys(side,'[0:5]={startedByUserId,account,scalar,startedByProfileId,profile,scalar}'::text[]); END IF;\n   parent:=NULL;\n   IF TG_TABLE_NAME='video_view' THEN\n    SELECT to_jsonb(c) INTO parent FROM channel c JOIN video v ON v.\"channelId\"=c.id WHERE v.id=(side->>'videoId')::uuid FOR SHARE OF c;\n   ELSE\n    parent_id:=(side->>'channelId')::uuid;\n    IF parent_id IS NOT NULL THEN SELECT to_jsonb(c) INTO parent FROM channel c WHERE c.id=parent_id FOR SHARE; END IF;\n   END IF;\n   IF parent IS NOT NULL THEN\n    keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]);\n    IF TG_OP<>'DELETE' AND op IS NULL AND (parent->>'userId'='00000000-0000-0000-0000-000000000000' OR parent->>'profileId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'VIDEO_DELETED_CONTAINER'; END IF;\n   ELSIF TG_OP<>'DELETE' AND op IS NULL AND (TG_TABLE_NAME<>'live_session' OR parent_id IS NOT NULL) THEN RAISE EXCEPTION 'VIDEO_PARENT_BINDING_UNVERIFIED'; END IF;\n  END IF;\n  -- A counterpart feed/schedule may reference this account's content; fence those late links too.\n  IF TG_TABLE_NAME IN ('channel_feed','program_block') THEN\n   SELECT to_jsonb(c) INTO parent FROM channel c JOIN video v ON v.\"channelId\"=c.id WHERE v.id=COALESCE(side->>'activeVideoId',side->>'videoId')::uuid FOR SHARE OF c;\n   IF parent IS NOT NULL THEN keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;\n  END IF;\n  IF TG_TABLE_NAME='channel_feed' THEN\n   SELECT to_jsonb(c) INTO parent FROM channel c JOIN program_block p ON p.\"channelId\"=c.id WHERE p.id=(side->>'activeProgramBlockId')::uuid FOR SHARE OF c;\n   IF parent IS NOT NULL THEN keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;\n   SELECT to_jsonb(l) INTO ref FROM live_session l WHERE l.id=(side->>'activeLiveSessionId')::uuid FOR SHARE;\n   IF ref IS NOT NULL THEN\n    keys:=keys||ot_collect_deletion_fence_keys(ref,'[0:5]={startedByUserId,account,scalar,startedByProfileId,profile,scalar}'::text[]);\n    SELECT to_jsonb(c) INTO parent FROM channel c WHERE c.id=(ref->>'channelId')::uuid FOR SHARE;\n    IF parent IS NOT NULL THEN keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;\n   END IF;\n  END IF;\n END LOOP;\n FOR k IN SELECT DISTINCT value FROM unnest(keys) AS value ORDER BY value LOOP\n  PERFORM pg_advisory_xact_lock(hashtextextended(k,0));\n  SELECT \"operationId\"::text INTO hit FROM account_deletion_write_fence WHERE \"key\"=k;\n  IF FOUND THEN ops:=array_append(ops,hit); END IF;\n END LOOP;\n IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED'; END IF;\n IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;"
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_channel BEFORE INSERT OR UPDATE OR DELETE ON "channel" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_video BEFORE INSERT OR UPDATE OR DELETE ON "video" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_channel_subscription BEFORE INSERT OR UPDATE OR DELETE ON "channel_subscription" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_video_view BEFORE INSERT OR UPDATE OR DELETE ON "video_view" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_channel_feed BEFORE INSERT OR UPDATE OR DELETE ON "channel_feed" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_program_block BEFORE INSERT OR UPDATE OR DELETE ON "program_block" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_videos_deletion_write_fence_live_session BEFORE INSERT OR UPDATE OR DELETE ON "live_session" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();'
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_live_session ON "live_session";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_program_block ON "program_block";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_channel_feed ON "channel_feed";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_video_view ON "video_view";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_channel_subscription ON "channel_subscription";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_video ON "video";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_channel ON "channel";'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_videos_deletion_write_guard();'
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
