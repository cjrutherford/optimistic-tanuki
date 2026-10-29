import { MigrationInterface, QueryRunner } from 'typeorm';
// CLI-generated schema delta, limited to D06. Frozen producer SQL; preserves migration-only election FKs.
export class AccountDeletionWriteFence1792938581387
  implements MigrationInterface
{
  name = 'AccountDeletionWriteFence1792938581387';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "user_block" DROP CONSTRAINT "UQ_d6b2a9c90a8c5f0997c6548c725"'
    );
    await queryRunner.query(
      'ALTER TABLE "user_mute" DROP CONSTRAINT "UQ_d3ac2d990086814549e498445b4"'
    );
    await queryRunner.query(
      'CREATE TABLE "account_deletion_write_fence" ("key" character varying(64) NOT NULL, "kind" character varying(24) NOT NULL, "operationId" uuid NOT NULL, "installedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60a9ab88c38291fb14c1a8a44ad" PRIMARY KEY ("key"))'
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_5b0072fa2019fba172bcccb9af" ON "user_block" ("blockerId", "blockedId") WHERE "blockedId" <> \'00000000-0000-0000-0000-000000000000\''
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_4fc1884e9febb8277818f35fe0" ON "user_mute" ("muterId", "mutedId") WHERE "mutedId" <> \'00000000-0000-0000-0000-000000000000\''
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT \"operationId\"::text INTO raw_value FROM account_deletion_write_fence WHERE \"key\" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;"
    );
    await queryRunner.query(
      "CREATE OR REPLACE FUNCTION ot_social_identity_keys(t text,body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$\n DECLARE result text[]:=ARRAY[]::text[]; BEGIN CASE t WHEN 'post' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile'),ot_deletion_fence_key(btrim(body->>'moderatedBy'),'profile')]::text[];\nWHEN 'comment' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile'),ot_deletion_fence_key(btrim(body->>'moderatedBy'),'profile')]::text[];\nWHEN 'poll' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'event' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'vote' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'reaction' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'follow_entity' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'followerId'),'profile'),ot_deletion_fence_key(btrim(body->>'followeeId'),'profile')]::text[];\nWHEN 'activity' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'saved_item' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'user_block' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'blockerId'),'profile'),ot_deletion_fence_key(btrim(body->>'blockedId'),'profile')]::text[];\nWHEN 'user_mute' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'muterId'),'profile'),ot_deletion_fence_key(btrim(body->>'mutedId'),'profile')]::text[];\nWHEN 'user_presence' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account')]::text[];\nWHEN 'profile_view' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'viewerId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'search_history' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'notification' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'recipientId'),'profile'),ot_deletion_fence_key(btrim(body->>'senderId'),'profile')]::text[];\nWHEN 'community_member' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'community_invite' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'inviterId'),'account'),ot_deletion_fence_key(btrim(body->>'inviteeId'),'account')]::text[];\nWHEN 'community' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'ownerId'),'account'),ot_deletion_fence_key(btrim(body->>'ownerProfileId'),'profile'),ot_deletion_fence_key(btrim(body->>'managerId'),'account'),ot_deletion_fence_key(btrim(body->>'managerProfileId'),'profile')]::text[];\nWHEN 'business_page_contents' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'ownerId'),'account')]::text[];\nWHEN 'community_sponsorship_contents' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account')]::text[];\nWHEN 'post_share' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'sharedById'),'profile')]::text[];\nWHEN 'guardian_published_asset_grant' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'actorUserId'),'account'),ot_deletion_fence_key(btrim(body->>'dependentProfileId'),'profile')]::text[];\nWHEN 'community_membership_audit' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'actorId'),'account'),ot_deletion_fence_key(btrim(body->>'subjectId'),'profile')]::text[];\nWHEN 'guardian_content_audit' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'actorUserId'),'account'),ot_deletion_fence_key(btrim(body->>'dependentUserId'),'account'),ot_deletion_fence_key(btrim(body->>'dependentProfileId'),'profile')]::text[];\nWHEN 'content_moderation_action' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'actorProfileId'),'profile')]::text[];\nWHEN 'content_report' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'reporterId'),'profile')]::text[];\nWHEN 'community_election' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'initiatedBy'),'account'),ot_deletion_fence_key(btrim(body->>'winnerId'),'account'),ot_deletion_fence_key(btrim(body->>'winnerProfileId'),'profile')]::text[];\nWHEN 'election_candidate' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'userId'),'account'),ot_deletion_fence_key(btrim(body->>'profileId'),'profile')]::text[];\nWHEN 'election_vote' THEN result:=ARRAY[ot_deletion_fence_key(btrim(body->>'voterId'),'account'),ot_deletion_fence_key(btrim(body->>'voterProfileId'),'profile'),ot_deletion_fence_key(btrim(body->>'candidateUserId'),'account')]::text[];\nWHEN 'attachment' THEN result:=ARRAY[]::text[];\nWHEN 'social_components' THEN result:=ARRAY[]::text[];\nWHEN 'link' THEN result:=ARRAY[]::text[];\nWHEN 'post_link' THEN result:=ARRAY[]::text[];\nWHEN 'business_theme_contents' THEN result:=ARRAY[]::text[]; ELSE RAISE EXCEPTION 'SOCIAL_DELETION_UNKNOWN_TABLE'; END CASE; RETURN result; END $ot$;\n CREATE OR REPLACE FUNCTION ot_social_poll_users(body jsonb) RETURNS jsonb LANGUAGE plpgsql AS $ot$\n DECLARE result jsonb:='{}'::jsonb; ballot jsonb; actor text; raw text:=COALESCE(body->>'votes',''); i integer:=0; BEGIN\n IF octet_length(raw)>1048576 THEN RAISE EXCEPTION 'SOCIAL_DELETION_COMPOUND_BOUND'; END IF;\n FOR ballot IN SELECT value FROM jsonb_array_elements(('['||raw||']')::jsonb) LOOP i:=i+1; IF i>10000 OR jsonb_typeof(ballot)<>'object' OR jsonb_typeof(ballot->'userId')<>'string' THEN RAISE EXCEPTION 'SOCIAL_DELETION_POLL_UNVERIFIED'; END IF; actor:=lower(btrim(ballot->>'userId')); IF ot_deletion_fence_key(actor,'account') IS NULL THEN RAISE EXCEPTION 'SOCIAL_DELETION_POLL_UNVERIFIED'; END IF; result:=jsonb_set(result,ARRAY[actor],COALESCE(result->actor,'[]'::jsonb)||jsonb_build_array(ballot)); END LOOP; RETURN result; END $ot$;\n CREATE OR REPLACE FUNCTION ot_social_attendees(body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$\n DECLARE result text[]:=ARRAY[]::text[]; actor text; raw text:=COALESCE(body->>'attendeeIds',''); BEGIN IF octet_length(raw)>1048576 THEN RAISE EXCEPTION 'SOCIAL_DELETION_COMPOUND_BOUND'; END IF;\n FOREACH actor IN ARRAY string_to_array(raw,',') LOOP actor:=lower(btrim(actor)); IF ot_deletion_fence_key(actor,'profile') IS NULL THEN RAISE EXCEPTION 'SOCIAL_DELETION_ATTENDANCE_UNVERIFIED'; END IF; result:=array_append(result,actor); IF cardinality(result)>10000 THEN RAISE EXCEPTION 'SOCIAL_DELETION_COMPOUND_BOUND'; END IF; END LOOP; RETURN result; END $ot$;\n CREATE OR REPLACE FUNCTION ot_social_deletion_write_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\n DECLARE oldbody jsonb; newbody jsonb; side jsonb; ref jsonb; sides jsonb[]:=ARRAY[]::jsonb[]; keys text[]:=ARRAY[]::text[]; ops text[]:=ARRAY[]::text[]; k text; hit text; actor text; oldpoll jsonb; newpoll jsonb; oldatt text[]; newatt text[]; op text:=NULLIF(current_setting('ot.deletion_operation',true),''); skip_self boolean:=false; immutable boolean:=false; subject_table text;\n BEGIN\n IF TG_OP<>'INSERT' THEN oldbody:=to_jsonb(OLD); END IF; IF TG_OP<>'DELETE' THEN newbody:=to_jsonb(NEW); END IF;\n IF TG_TABLE_NAME='saved_item' AND TG_OP<>'DELETE' AND op IS NULL THEN\n  subject_table:=CASE NEW.\"itemType\"::text WHEN 'post' THEN 'post' WHEN 'comment' THEN 'comment' ELSE NULL END;\n  IF subject_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1',subject_table) INTO ref USING lower(btrim(NEW.\"itemId\")); IF ref->>'userId'='00000000-0000-0000-0000-000000000000' THEN NEW.\"itemTitle\":=NULL;newbody:=to_jsonb(NEW);END IF;END IF;\n END IF;\n IF TG_OP='UPDATE' AND TG_TABLE_NAME='community' THEN skip_self:=(oldbody->'ownerId',oldbody->'ownerProfileId',oldbody->'managerId',oldbody->'managerProfileId') IS NOT DISTINCT FROM (newbody->'ownerId',newbody->'ownerProfileId',newbody->'managerId',newbody->'managerProfileId'); END IF;\n IF TG_OP='UPDATE' AND TG_TABLE_NAME='community_election' THEN skip_self:=(oldbody->'initiatedBy',oldbody->'winnerId',oldbody->'winnerProfileId') IS NOT DISTINCT FROM (newbody->'initiatedBy',newbody->'winnerId',newbody->'winnerProfileId'); END IF;\n IF TG_TABLE_NAME='poll' THEN\n  oldpoll:=ot_social_poll_users(oldbody);newpoll:=ot_social_poll_users(newbody);\n  FOR actor IN SELECT x FROM (SELECT jsonb_object_keys(oldpoll) x UNION SELECT jsonb_object_keys(newpoll) x) s WHERE oldpoll->x IS DISTINCT FROM newpoll->x LOOP keys:=array_append(keys,ot_deletion_fence_key(actor,'account'));END LOOP;\n END IF;\n IF TG_TABLE_NAME='event' THEN\n  oldatt:=ot_social_attendees(oldbody);newatt:=ot_social_attendees(newbody);\n  FOR actor IN SELECT x FROM (SELECT unnest(oldatt) x EXCEPT SELECT unnest(newatt) x) d UNION SELECT x FROM (SELECT unnest(newatt) x EXCEPT SELECT unnest(oldatt) x) a LOOP keys:=array_append(keys,ot_deletion_fence_key(actor,'profile'));END LOOP;\n END IF;\n IF op IS NULL AND TG_TABLE_NAME IN ('post','comment','poll','event','election_candidate','business_page_contents') THEN\n  immutable:=COALESCE(oldbody->>'userId',oldbody->>'ownerId')='00000000-0000-0000-0000-000000000000' OR COALESCE(newbody->>'userId',newbody->>'ownerId')='00000000-0000-0000-0000-000000000000';\n  IF immutable AND TG_TABLE_NAME='business_page_contents' AND TG_OP='UPDATE' AND newbody->>'ownerId'<>'00000000-0000-0000-0000-000000000000' THEN immutable:=false;END IF;\n  IF immutable AND TG_OP='UPDATE' AND TG_TABLE_NAME='poll' AND (oldbody-'votes')=(newbody-'votes') AND NOT EXISTS(SELECT 1 FROM jsonb_each(newpoll) n WHERE oldpoll->n.key IS DISTINCT FROM n.value) THEN immutable:=false;END IF;\n  IF immutable AND TG_OP='UPDATE' AND TG_TABLE_NAME='event' AND (oldbody-ARRAY['attendeeIds','attendeeCount','updatedAt'])=(newbody-ARRAY['attendeeIds','attendeeCount','updatedAt']) AND newatt<@oldatt THEN immutable:=false;END IF;\n  IF immutable THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER';END IF;\n END IF;\n IF op IS NULL AND TG_TABLE_NAME='content_report' AND TG_OP<>'DELETE' AND (newbody->>'reporterId'='00000000-0000-0000-0000-000000000000' OR newbody->>'contentId'='00000000-0000-0000-0000-000000000000') AND (newbody->>'description' IS NOT NULL OR newbody->>'adminNotes' IS NOT NULL) THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTEXT';END IF;\n IF oldbody IS NOT NULL THEN sides:=array_append(sides,oldbody);END IF;IF newbody IS NOT NULL THEN sides:=array_append(sides,newbody);END IF;\n FOREACH side IN ARRAY sides LOOP\n  IF NOT skip_self THEN keys:=keys||ot_social_identity_keys(TG_TABLE_NAME,side);END IF;\n  IF TG_TABLE_NAME='attachment' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'postId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref); IF TG_OP<>'DELETE' AND op IS NULL AND (ref->>'userId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER'; END IF; END IF; END IF;\nIF TG_TABLE_NAME='social_components' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'postId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref); IF TG_OP<>'DELETE' AND op IS NULL AND (ref->>'userId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER'; END IF; END IF; END IF;\nIF TG_TABLE_NAME='post_link' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'postId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref); IF TG_OP<>'DELETE' AND op IS NULL AND (ref->>'userId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER'; END IF; END IF; END IF;\nIF TG_TABLE_NAME='comment' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'postId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref);  END IF;\nSELECT to_jsonb(p) INTO ref FROM \"comment\" p WHERE p.id::text=lower(btrim(side->>'parentId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('comment',ref);  END IF; END IF;\nIF TG_TABLE_NAME='vote' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'postId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref);  END IF;\nSELECT to_jsonb(p) INTO ref FROM \"comment\" p WHERE p.id::text=lower(btrim(side->>'commentId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('comment',ref);  END IF; END IF;\nIF TG_TABLE_NAME='reaction' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'postId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref);  END IF;\nSELECT to_jsonb(p) INTO ref FROM \"comment\" p WHERE p.id::text=lower(btrim(side->>'commentId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('comment',ref);  END IF; END IF;\nIF TG_TABLE_NAME='post_share' THEN SELECT to_jsonb(p) INTO ref FROM \"post\" p WHERE p.id::text=lower(btrim(side->>'originalPostId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('post',ref);  END IF; END IF;\nIF TG_TABLE_NAME='business_theme_contents' THEN SELECT to_jsonb(p) INTO ref FROM \"business_page_contents\" p WHERE p.id::text=lower(btrim(side->>'businessPageId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('business_page_contents',ref); IF TG_OP<>'DELETE' AND op IS NULL AND (ref->>'userId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER'; END IF; END IF; END IF;\nIF TG_TABLE_NAME='election_vote' THEN SELECT to_jsonb(p) INTO ref FROM \"election_candidate\" p WHERE p.id::text=lower(btrim(side->>'candidateId')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('election_candidate',ref); IF TG_OP<>'DELETE' AND op IS NULL AND (ref->>'userId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER'; END IF; END IF; END IF;\n  IF TG_TABLE_NAME='saved_item' THEN subject_table:=CASE side->>'itemType' WHEN 'post' THEN 'post' WHEN 'comment' THEN 'comment' ELSE NULL END;IF subject_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1 FOR SHARE',subject_table) INTO ref USING lower(btrim(side->>'itemId'));IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys(subject_table,ref);END IF;END IF;END IF;\n  IF TG_TABLE_NAME='notification' AND side->>'resourceType'='profile' THEN keys:=array_append(keys,ot_deletion_fence_key(btrim(side->>'resourceId'),'profile'));END IF;\n  IF TG_TABLE_NAME IN ('content_report','content_moderation_action') THEN\n   subject_table:=CASE COALESCE(side->>'contentType',side->>'subjectType') WHEN 'post' THEN 'post' WHEN 'comment' THEN 'comment' ELSE NULL END;\n   IF subject_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1 FOR SHARE',subject_table) INTO ref USING lower(btrim(COALESCE(side->>'contentId',side->>'subjectId')));IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys(subject_table,ref);IF TG_OP='INSERT' AND op IS NULL AND ref->>'userId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTEXT';END IF;END IF;\n   ELSIF COALESCE(side->>'contentType',side->>'subjectType')='profile' THEN keys:=array_append(keys,ot_deletion_fence_key(btrim(COALESCE(side->>'contentId',side->>'subjectId')),'profile'));END IF;\n  END IF;\n END LOOP;\n FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT \"operationId\"::text INTO hit FROM account_deletion_write_fence WHERE \"key\"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;\n IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;\n IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;\n END $ot$;"
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_post BEFORE INSERT OR UPDATE OR DELETE ON "post" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_comment BEFORE INSERT OR UPDATE OR DELETE ON "comment" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_poll BEFORE INSERT OR UPDATE OR DELETE ON "poll" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_event BEFORE INSERT OR UPDATE OR DELETE ON "event" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_vote BEFORE INSERT OR UPDATE OR DELETE ON "vote" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_reaction BEFORE INSERT OR UPDATE OR DELETE ON "reaction" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_follow_entity BEFORE INSERT OR UPDATE OR DELETE ON "follow_entity" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_activity BEFORE INSERT OR UPDATE OR DELETE ON "activity" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_saved_item BEFORE INSERT OR UPDATE OR DELETE ON "saved_item" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_user_block BEFORE INSERT OR UPDATE OR DELETE ON "user_block" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_user_mute BEFORE INSERT OR UPDATE OR DELETE ON "user_mute" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_user_presence BEFORE INSERT OR UPDATE OR DELETE ON "user_presence" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_profile_view BEFORE INSERT OR UPDATE OR DELETE ON "profile_view" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_search_history BEFORE INSERT OR UPDATE OR DELETE ON "search_history" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_notification BEFORE INSERT OR UPDATE OR DELETE ON "notification" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_community_member BEFORE INSERT OR UPDATE OR DELETE ON "community_member" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_community_invite BEFORE INSERT OR UPDATE OR DELETE ON "community_invite" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_community BEFORE INSERT OR UPDATE OR DELETE ON "community" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_business_page_contents BEFORE INSERT OR UPDATE OR DELETE ON "business_page_contents" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_community_sponsorship_contents BEFORE INSERT OR UPDATE OR DELETE ON "community_sponsorship_contents" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_post_share BEFORE INSERT OR UPDATE OR DELETE ON "post_share" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_guardian_published_asset_grant BEFORE INSERT OR UPDATE OR DELETE ON "guardian_published_asset_grant" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_community_membership_audit BEFORE INSERT OR UPDATE OR DELETE ON "community_membership_audit" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_guardian_content_audit BEFORE INSERT OR UPDATE OR DELETE ON "guardian_content_audit" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_content_moderation_action BEFORE INSERT OR UPDATE OR DELETE ON "content_moderation_action" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_content_report BEFORE INSERT OR UPDATE OR DELETE ON "content_report" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_community_election BEFORE INSERT OR UPDATE OR DELETE ON "community_election" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_election_candidate BEFORE INSERT OR UPDATE OR DELETE ON "election_candidate" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_election_vote BEFORE INSERT OR UPDATE OR DELETE ON "election_vote" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_attachment BEFORE INSERT OR UPDATE OR DELETE ON "attachment" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_social_components BEFORE INSERT OR UPDATE OR DELETE ON "social_components" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_link BEFORE INSERT OR UPDATE OR DELETE ON "link" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_post_link BEFORE INSERT OR UPDATE OR DELETE ON "post_link" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'CREATE TRIGGER ot_social_deletion_fence_business_theme_contents BEFORE INSERT OR UPDATE OR DELETE ON "business_theme_contents" FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();'
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_4fc1884e9febb8277818f35fe0"'
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_5b0072fa2019fba172bcccb9af"'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_post ON "post";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_comment ON "comment";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_poll ON "poll";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_event ON "event";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_vote ON "vote";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_reaction ON "reaction";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_follow_entity ON "follow_entity";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_activity ON "activity";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_saved_item ON "saved_item";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_user_block ON "user_block";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_user_mute ON "user_mute";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_user_presence ON "user_presence";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_profile_view ON "profile_view";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_search_history ON "search_history";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_notification ON "notification";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_community_member ON "community_member";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_community_invite ON "community_invite";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_community ON "community";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_business_page_contents ON "business_page_contents";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_community_sponsorship_contents ON "community_sponsorship_contents";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_post_share ON "post_share";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_guardian_published_asset_grant ON "guardian_published_asset_grant";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_community_membership_audit ON "community_membership_audit";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_guardian_content_audit ON "guardian_content_audit";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_content_moderation_action ON "content_moderation_action";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_content_report ON "content_report";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_community_election ON "community_election";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_election_candidate ON "election_candidate";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_election_vote ON "election_vote";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_attachment ON "attachment";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_social_components ON "social_components";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_link ON "link";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_post_link ON "post_link";'
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ot_social_deletion_fence_business_theme_contents ON "business_theme_contents";'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_social_deletion_write_guard();'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_social_poll_users(jsonb);'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_social_attendees(jsonb);'
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS ot_social_identity_keys(text,jsonb);'
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
      'ALTER TABLE "user_mute" ADD CONSTRAINT "UQ_d3ac2d990086814549e498445b4" UNIQUE ("muterId", "mutedId")'
    );
    await queryRunner.query(
      'ALTER TABLE "user_block" ADD CONSTRAINT "UQ_d6b2a9c90a8c5f0997c6548c725" UNIQUE ("blockerId", "blockedId")'
    );
  }
}
