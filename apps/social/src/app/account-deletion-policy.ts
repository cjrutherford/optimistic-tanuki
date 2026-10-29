import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
type Kind = 'account' | 'profile';
export const SOCIAL_DELETION_IDENTITIES: Readonly<
  Record<string, readonly (readonly [string, Kind])[]>
> = {
  post: [
    ['userId', 'account'],
    ['profileId', 'profile'],
    ['moderatedBy', 'profile'],
  ],
  comment: [
    ['userId', 'account'],
    ['profileId', 'profile'],
    ['moderatedBy', 'profile'],
  ],
  poll: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  event: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  vote: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  reaction: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  follow_entity: [
    ['followerId', 'profile'],
    ['followeeId', 'profile'],
  ],
  activity: [['profileId', 'profile']],
  saved_item: [['profileId', 'profile']],
  user_block: [
    ['blockerId', 'profile'],
    ['blockedId', 'profile'],
  ],
  user_mute: [
    ['muterId', 'profile'],
    ['mutedId', 'profile'],
  ],
  user_presence: [['userId', 'account']],
  profile_view: [
    ['viewerId', 'account'],
    ['profileId', 'profile'],
  ],
  search_history: [['profileId', 'profile']],
  notification: [
    ['recipientId', 'profile'],
    ['senderId', 'profile'],
  ],
  community_member: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  community_invite: [
    ['inviterId', 'account'],
    ['inviteeId', 'account'],
  ],
  community: [
    ['ownerId', 'account'],
    ['ownerProfileId', 'profile'],
    ['managerId', 'account'],
    ['managerProfileId', 'profile'],
  ],
  business_page_contents: [['ownerId', 'account']],
  community_sponsorship_contents: [['userId', 'account']],
  post_share: [['sharedById', 'profile']],
  guardian_published_asset_grant: [
    ['actorUserId', 'account'],
    ['dependentProfileId', 'profile'],
  ],
  community_membership_audit: [
    ['actorId', 'account'],
    ['subjectId', 'profile'],
  ],
  guardian_content_audit: [
    ['actorUserId', 'account'],
    ['dependentUserId', 'account'],
    ['dependentProfileId', 'profile'],
  ],
  content_moderation_action: [['actorProfileId', 'profile']],
  content_report: [['reporterId', 'profile']],
  community_election: [
    ['initiatedBy', 'account'],
    ['winnerId', 'account'],
    ['winnerProfileId', 'profile'],
  ],
  election_candidate: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  election_vote: [
    ['voterId', 'account'],
    ['voterProfileId', 'profile'],
    ['candidateUserId', 'account'],
  ],
  attachment: [],
  social_components: [],
  link: [],
  post_link: [],
  business_theme_contents: [],
};
const refs: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  attachment: [['postId', 'post']],
  social_components: [['postId', 'post']],
  post_link: [['postId', 'post']],
  comment: [
    ['postId', 'post'],
    ['parentId', 'comment'],
  ],
  vote: [
    ['postId', 'post'],
    ['commentId', 'comment'],
  ],
  reaction: [
    ['postId', 'post'],
    ['commentId', 'comment'],
  ],
  post_share: [['originalPostId', 'post']],
  business_theme_contents: [['businessPageId', 'business_page_contents']],
  election_vote: [['candidateId', 'election_candidate']],
};
const quote = (name: string) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw Error('SOCIAL_DELETION_SQL_IDENTIFIER');
  return `"${name}"`;
};

export function socialDeletionFenceSql() {
  const shared = generateDeletionWriteFenceSql([]);
  const cases = Object.entries(SOCIAL_DELETION_IDENTITIES)
    .map(
      ([table, fields]) =>
        `WHEN '${table}' THEN result:=ARRAY[${fields
          .map(
            ([col, kind]) =>
              `ot_deletion_fence_key(btrim(body->>'${col}'),'${kind}')`
          )
          .join(',')}]::text[];`
    )
    .join('\n');
  const parentCases = Object.entries(refs)
    .map(
      ([table, fields]) =>
        `IF TG_TABLE_NAME='${table}' THEN ${fields
          .map(
            ([col, parent]) =>
              `SELECT to_jsonb(p) INTO ref FROM ${quote(
                parent
              )} p WHERE p.id::text=lower(btrim(side->>'${col}')) FOR SHARE; IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys('${parent}',ref); ${
                [
                  'attachment',
                  'social_components',
                  'post_link',
                  'business_theme_contents',
                  'election_vote',
                ].includes(table)
                  ? `IF TG_OP<>'DELETE' AND op IS NULL AND (ref->>'userId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER'; END IF;`
                  : ''
              } END IF;`
          )
          .join('\n')} END IF;`
    )
    .join('\n');
  const functions = `CREATE OR REPLACE FUNCTION ot_social_identity_keys(t text,body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$
 DECLARE result text[]:=ARRAY[]::text[]; BEGIN CASE t ${cases} ELSE RAISE EXCEPTION 'SOCIAL_DELETION_UNKNOWN_TABLE'; END CASE; RETURN result; END $ot$;
 CREATE OR REPLACE FUNCTION ot_social_poll_users(body jsonb) RETURNS jsonb LANGUAGE plpgsql AS $ot$
 DECLARE result jsonb:='{}'::jsonb; ballot jsonb; actor text; raw text:=COALESCE(body->>'votes',''); i integer:=0; BEGIN
 IF octet_length(raw)>1048576 THEN RAISE EXCEPTION 'SOCIAL_DELETION_COMPOUND_BOUND'; END IF;
 FOR ballot IN SELECT value FROM jsonb_array_elements(('['||raw||']')::jsonb) LOOP i:=i+1; IF i>10000 OR jsonb_typeof(ballot)<>'object' OR jsonb_typeof(ballot->'userId')<>'string' THEN RAISE EXCEPTION 'SOCIAL_DELETION_POLL_UNVERIFIED'; END IF; actor:=lower(btrim(ballot->>'userId')); IF ot_deletion_fence_key(actor,'account') IS NULL THEN RAISE EXCEPTION 'SOCIAL_DELETION_POLL_UNVERIFIED'; END IF; result:=jsonb_set(result,ARRAY[actor],COALESCE(result->actor,'[]'::jsonb)||jsonb_build_array(ballot)); END LOOP; RETURN result; END $ot$;
 CREATE OR REPLACE FUNCTION ot_social_attendees(body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$
 DECLARE result text[]:=ARRAY[]::text[]; actor text; raw text:=COALESCE(body->>'attendeeIds',''); BEGIN IF octet_length(raw)>1048576 THEN RAISE EXCEPTION 'SOCIAL_DELETION_COMPOUND_BOUND'; END IF;
 FOREACH actor IN ARRAY string_to_array(raw,',') LOOP actor:=lower(btrim(actor)); IF ot_deletion_fence_key(actor,'profile') IS NULL THEN RAISE EXCEPTION 'SOCIAL_DELETION_ATTENDANCE_UNVERIFIED'; END IF; result:=array_append(result,actor); IF cardinality(result)>10000 THEN RAISE EXCEPTION 'SOCIAL_DELETION_COMPOUND_BOUND'; END IF; END LOOP; RETURN result; END $ot$;
 CREATE OR REPLACE FUNCTION ot_social_deletion_write_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
 DECLARE oldbody jsonb; newbody jsonb; side jsonb; ref jsonb; sides jsonb[]:=ARRAY[]::jsonb[]; keys text[]:=ARRAY[]::text[]; ops text[]:=ARRAY[]::text[]; k text; hit text; actor text; oldpoll jsonb; newpoll jsonb; oldatt text[]; newatt text[]; op text:=NULLIF(current_setting('ot.deletion_operation',true),''); skip_self boolean:=false; immutable boolean:=false; subject_table text;
 BEGIN
 IF TG_OP<>'INSERT' THEN oldbody:=to_jsonb(OLD); END IF; IF TG_OP<>'DELETE' THEN newbody:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='saved_item' AND TG_OP<>'DELETE' AND op IS NULL THEN
  subject_table:=CASE NEW."itemType"::text WHEN 'post' THEN 'post' WHEN 'comment' THEN 'comment' ELSE NULL END;
  IF subject_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1',subject_table) INTO ref USING lower(btrim(NEW."itemId")); IF ref->>'userId'='00000000-0000-0000-0000-000000000000' THEN NEW."itemTitle":=NULL;newbody:=to_jsonb(NEW);END IF;END IF;
 END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='community' THEN skip_self:=(oldbody->'ownerId',oldbody->'ownerProfileId',oldbody->'managerId',oldbody->'managerProfileId') IS NOT DISTINCT FROM (newbody->'ownerId',newbody->'ownerProfileId',newbody->'managerId',newbody->'managerProfileId'); END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='community_election' THEN skip_self:=(oldbody->'initiatedBy',oldbody->'winnerId',oldbody->'winnerProfileId') IS NOT DISTINCT FROM (newbody->'initiatedBy',newbody->'winnerId',newbody->'winnerProfileId'); END IF;
 IF TG_TABLE_NAME='poll' THEN
  oldpoll:=ot_social_poll_users(oldbody);newpoll:=ot_social_poll_users(newbody);
  FOR actor IN SELECT x FROM (SELECT jsonb_object_keys(oldpoll) x UNION SELECT jsonb_object_keys(newpoll) x) s WHERE oldpoll->x IS DISTINCT FROM newpoll->x LOOP keys:=array_append(keys,ot_deletion_fence_key(actor,'account'));END LOOP;
 END IF;
 IF TG_TABLE_NAME='event' THEN
  oldatt:=ot_social_attendees(oldbody);newatt:=ot_social_attendees(newbody);
  FOR actor IN SELECT x FROM (SELECT unnest(oldatt) x EXCEPT SELECT unnest(newatt) x) d UNION SELECT x FROM (SELECT unnest(newatt) x EXCEPT SELECT unnest(oldatt) x) a LOOP keys:=array_append(keys,ot_deletion_fence_key(actor,'profile'));END LOOP;
 END IF;
 IF op IS NULL AND TG_TABLE_NAME IN ('post','comment','poll','event','election_candidate','business_page_contents') THEN
  immutable:=COALESCE(oldbody->>'userId',oldbody->>'ownerId')='00000000-0000-0000-0000-000000000000' OR COALESCE(newbody->>'userId',newbody->>'ownerId')='00000000-0000-0000-0000-000000000000';
  IF immutable AND TG_TABLE_NAME='business_page_contents' AND TG_OP='UPDATE' AND newbody->>'ownerId'<>'00000000-0000-0000-0000-000000000000' THEN immutable:=false;END IF;
  IF immutable AND TG_OP='UPDATE' AND TG_TABLE_NAME='poll' AND (oldbody-'votes')=(newbody-'votes') AND NOT EXISTS(SELECT 1 FROM jsonb_each(newpoll) n WHERE oldpoll->n.key IS DISTINCT FROM n.value) THEN immutable:=false;END IF;
  IF immutable AND TG_OP='UPDATE' AND TG_TABLE_NAME='event' AND (oldbody-ARRAY['attendeeIds','attendeeCount','updatedAt'])=(newbody-ARRAY['attendeeIds','attendeeCount','updatedAt']) AND newatt<@oldatt THEN immutable:=false;END IF;
  IF immutable THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTAINER';END IF;
 END IF;
 IF op IS NULL AND TG_TABLE_NAME='content_report' AND TG_OP<>'DELETE' AND (newbody->>'reporterId'='00000000-0000-0000-0000-000000000000' OR newbody->>'contentId'='00000000-0000-0000-0000-000000000000') AND (newbody->>'description' IS NOT NULL OR newbody->>'adminNotes' IS NOT NULL) THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTEXT';END IF;
 IF oldbody IS NOT NULL THEN sides:=array_append(sides,oldbody);END IF;IF newbody IS NOT NULL THEN sides:=array_append(sides,newbody);END IF;
 FOREACH side IN ARRAY sides LOOP
  IF NOT skip_self THEN keys:=keys||ot_social_identity_keys(TG_TABLE_NAME,side);END IF;
  ${parentCases}
  IF TG_TABLE_NAME='saved_item' THEN subject_table:=CASE side->>'itemType' WHEN 'post' THEN 'post' WHEN 'comment' THEN 'comment' ELSE NULL END;IF subject_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1 FOR SHARE',subject_table) INTO ref USING lower(btrim(side->>'itemId'));IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys(subject_table,ref);END IF;END IF;END IF;
  IF TG_TABLE_NAME='notification' AND side->>'resourceType'='profile' THEN keys:=array_append(keys,ot_deletion_fence_key(btrim(side->>'resourceId'),'profile'));END IF;
  IF TG_TABLE_NAME IN ('content_report','content_moderation_action') THEN
   subject_table:=CASE COALESCE(side->>'contentType',side->>'subjectType') WHEN 'post' THEN 'post' WHEN 'comment' THEN 'comment' ELSE NULL END;
   IF subject_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1 FOR SHARE',subject_table) INTO ref USING lower(btrim(COALESCE(side->>'contentId',side->>'subjectId')));IF ref IS NOT NULL THEN keys:=keys||ot_social_identity_keys(subject_table,ref);IF TG_OP='INSERT' AND op IS NULL AND ref->>'userId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'SOCIAL_DELETED_CONTEXT';END IF;END IF;
   ELSIF COALESCE(side->>'contentType',side->>'subjectType')='profile' THEN keys:=array_append(keys,ot_deletion_fence_key(btrim(COALESCE(side->>'contentId',side->>'subjectId')),'profile'));END IF;
  END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;
 IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
 END $ot$;`;
  const tables = Object.keys(SOCIAL_DELETION_IDENTITIES);
  return {
    up: [
      ...shared.up,
      functions,
      ...tables.map(
        (t) =>
          `CREATE TRIGGER ot_social_deletion_fence_${t} BEFORE INSERT OR UPDATE OR DELETE ON ${quote(
            t
          )} FOR EACH ROW EXECUTE FUNCTION ot_social_deletion_write_guard();`
      ),
    ],
    down: [
      ...tables.map(
        (t) =>
          `DROP TRIGGER IF EXISTS ot_social_deletion_fence_${t} ON ${quote(t)};`
      ),
      'DROP FUNCTION IF EXISTS ot_social_deletion_write_guard();',
      'DROP FUNCTION IF EXISTS ot_social_poll_users(jsonb);',
      'DROP FUNCTION IF EXISTS ot_social_attendees(jsonb);',
      'DROP FUNCTION IF EXISTS ot_social_identity_keys(text,jsonb);',
      ...shared.down,
    ],
  };
}
