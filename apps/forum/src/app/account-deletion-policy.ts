import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
export const FORUM_DELETION_IDENTITIES: Readonly<
  Record<string, readonly (readonly [string, 'account' | 'profile'])[]>
> = {
  topic: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
  thread: [
    ['userId', 'account'],
    ['profileId', 'profile'],
    ['moderatedBy', 'profile'],
  ],
  forum_post: [
    ['userId', 'account'],
    ['profileId', 'profile'],
    ['moderatedBy', 'profile'],
  ],
  forum_report: [['reporterId', 'profile']],
  forum_moderation_action: [['actorProfileId', 'profile']],
  forum_link: [],
  forum_post_links_forum_link: [],
};
export function forumDeletionFenceSql() {
  const shared = generateDeletionWriteFenceSql([]);
  const cases = Object.entries(FORUM_DELETION_IDENTITIES)
    .map(
      ([table, fields]) =>
        `WHEN '${table}' THEN RETURN ARRAY[${fields
          .map(
            ([col, kind]) =>
              `ot_deletion_fence_key(btrim(body->>'${col}'),'${kind}')`
          )
          .join(',')}]::text[];`
    )
    .join('\n');
  const functions = `CREATE FUNCTION ot_forum_identity_keys(t text,body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$ BEGIN CASE t ${cases} ELSE RAISE EXCEPTION 'FORUM_DELETION_UNKNOWN_TABLE';END CASE;END $ot$;
 CREATE FUNCTION ot_forum_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
 DECLARE oldbody jsonb;newbody jsonb;side jsonb;ref jsonb;sides jsonb[]:=ARRAY[]::jsonb[];keys text[]:=ARRAY[]::text[];ops text[]:=ARRAY[]::text[];k text;hit text;parent_table text;parent_id text;op text:=NULLIF(current_setting('ot.deletion_operation',true),'');
 BEGIN
 IF TG_OP<>'INSERT' THEN oldbody:=to_jsonb(OLD);sides:=array_append(sides,oldbody);END IF;IF TG_OP<>'DELETE' THEN newbody:=to_jsonb(NEW);sides:=array_append(sides,newbody);END IF;
 IF op IS NULL AND TG_TABLE_NAME IN('topic','thread','forum_post') AND (oldbody->>'userId'='00000000-0000-0000-0000-000000000000' OR newbody->>'userId'='00000000-0000-0000-0000-000000000000') THEN
  IF NOT(TG_TABLE_NAME='thread' AND TG_OP='UPDATE' AND (oldbody-ARRAY['viewCount','updatedAt'])=(newbody-ARRAY['viewCount','updatedAt'])) THEN RAISE EXCEPTION 'FORUM_DELETED_CONTAINER';END IF;
 END IF;
 IF op IS NULL AND TG_TABLE_NAME='forum_report' AND TG_OP<>'DELETE' AND (newbody->>'reporterId'='00000000-0000-0000-0000-000000000000' OR newbody->>'contentId'='00000000-0000-0000-0000-000000000000') AND (newbody->>'description' IS NOT NULL OR newbody->>'adminNotes' IS NOT NULL) THEN RAISE EXCEPTION 'FORUM_DELETED_CONTEXT';END IF;
 FOREACH side IN ARRAY sides LOOP
  keys:=keys||ot_forum_identity_keys(TG_TABLE_NAME,side);
  parent_table:=NULL;parent_id:=NULL;
  IF TG_TABLE_NAME='thread' THEN parent_table:='topic';parent_id:=side->>'topicId';
  ELSIF TG_TABLE_NAME='forum_post' THEN parent_table:='thread';parent_id:=side->>'threadId';
  ELSIF TG_TABLE_NAME='forum_post_links_forum_link' THEN parent_table:='forum_post';parent_id:=side->>'forumPostId';
  ELSIF TG_TABLE_NAME IN('forum_report','forum_moderation_action') THEN parent_table:=CASE COALESCE(side->>'contentType',side->>'subjectType') WHEN 'thread' THEN 'thread' WHEN 'post' THEN 'forum_post' END;parent_id:=COALESCE(side->>'contentId',side->>'subjectId');END IF;
  IF parent_table IS NOT NULL THEN EXECUTE format('SELECT to_jsonb(p) FROM %I p WHERE p.id::text=$1 FOR SHARE',parent_table) INTO ref USING lower(btrim(parent_id));IF ref IS NOT NULL THEN keys:=keys||ot_forum_identity_keys(parent_table,ref);IF op IS NULL AND TG_OP<>'DELETE' AND TG_TABLE_NAME IN ('forum_post_links_forum_link','forum_report','forum_moderation_action') AND ref->>'userId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'FORUM_DELETED_CONTAINER';END IF;END IF;END IF;
  IF TG_TABLE_NAME='forum_link' THEN FOR ref IN SELECT to_jsonb(p) FROM forum_post p JOIN forum_post_links_forum_link j ON j."forumPostId"=p.id WHERE j."forumLinkId"::text=side->>'id' FOR SHARE OF p LOOP keys:=keys||ot_forum_identity_keys('forum_post',ref);END LOOP;END IF;
  IF TG_TABLE_NAME='forum_moderation_action' AND side->>'action'='report_status' THEN SELECT to_jsonb(r) INTO ref FROM forum_report r WHERE r.id::text=side->'details'->>'reportId' FOR SHARE;IF ref IS NOT NULL THEN keys:=keys||ot_forum_identity_keys('forum_report',ref);IF op IS NULL AND TG_OP<>'DELETE' AND ref->>'reporterId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'FORUM_DELETED_CONTEXT';END IF;END IF;END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;
 IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;`;
  const tables = Object.keys(FORUM_DELETION_IDENTITIES);
  return {
    up: [
      ...shared.up,
      functions,
      ...tables.map(
        (t) =>
          `CREATE TRIGGER ot_forum_deletion_${t} BEFORE INSERT OR UPDATE OR DELETE ON "${t}" FOR EACH ROW EXECUTE FUNCTION ot_forum_deletion_guard();`
      ),
    ],
    down: [
      ...tables.map(
        (t) => `DROP TRIGGER IF EXISTS ot_forum_deletion_${t} ON "${t}";`
      ),
      'DROP FUNCTION IF EXISTS ot_forum_deletion_guard();',
      'DROP FUNCTION IF EXISTS ot_forum_identity_keys(text,jsonb);',
      ...shared.down,
    ],
  };
}
