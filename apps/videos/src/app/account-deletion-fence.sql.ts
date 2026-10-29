import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';

/** Frozen by the owning generated migration; no runtime migration dependency. */
export function videosDeletionFenceSql(): { up: string[]; down: string[] } {
  const shared = generateDeletionWriteFenceSql([]);
  const tables = [
    'channel',
    'video',
    'channel_subscription',
    'video_view',
    'channel_feed',
    'program_block',
    'live_session',
  ];
  const guard = `CREATE OR REPLACE FUNCTION ot_videos_deletion_write_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
DECLARE side jsonb; sides jsonb[]:=ARRAY[]::jsonb[]; parent jsonb; ref jsonb; parent_id uuid; item text; k text; keys text[]:=ARRAY[]::text[]; ops text[]:=ARRAY[]::text[]; hit text; op text:=NULLIF(current_setting('ot.deletion_operation',true),'');
BEGIN
 IF TG_OP<>'INSERT' THEN sides:=array_append(sides,to_jsonb(OLD)); END IF;
 IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW)); END IF;
 FOREACH side IN ARRAY sides LOOP
  IF TG_TABLE_NAME='channel' THEN
   keys:=keys||ot_collect_deletion_fence_keys(side,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]);
   IF (side->>'userId'='00000000-0000-0000-0000-000000000000' OR side->>'profileId'='00000000-0000-0000-0000-000000000000') AND op IS NULL THEN RAISE EXCEPTION 'VIDEO_DELETED_CONTAINER'; END IF;
  ELSE
   IF TG_TABLE_NAME IN ('video_view','channel_subscription') THEN keys:=keys||ot_collect_deletion_fence_keys(side,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;
   IF TG_TABLE_NAME='live_session' THEN keys:=keys||ot_collect_deletion_fence_keys(side,'[0:5]={startedByUserId,account,scalar,startedByProfileId,profile,scalar}'::text[]); END IF;
   parent:=NULL;
   IF TG_TABLE_NAME='video_view' THEN
    SELECT to_jsonb(c) INTO parent FROM channel c JOIN video v ON v."channelId"=c.id WHERE v.id=(side->>'videoId')::uuid FOR SHARE OF c;
   ELSE
    parent_id:=(side->>'channelId')::uuid;
    IF parent_id IS NOT NULL THEN SELECT to_jsonb(c) INTO parent FROM channel c WHERE c.id=parent_id FOR SHARE; END IF;
   END IF;
   IF parent IS NOT NULL THEN
    keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]);
    IF TG_OP<>'DELETE' AND op IS NULL AND (parent->>'userId'='00000000-0000-0000-0000-000000000000' OR parent->>'profileId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'VIDEO_DELETED_CONTAINER'; END IF;
   ELSIF TG_OP<>'DELETE' AND op IS NULL AND (TG_TABLE_NAME<>'live_session' OR parent_id IS NOT NULL) THEN RAISE EXCEPTION 'VIDEO_PARENT_BINDING_UNVERIFIED'; END IF;
  END IF;
  -- A counterpart feed/schedule may reference this account's content; fence those late links too.
  IF TG_TABLE_NAME IN ('channel_feed','program_block') THEN
   SELECT to_jsonb(c) INTO parent FROM channel c JOIN video v ON v."channelId"=c.id WHERE v.id=COALESCE(side->>'activeVideoId',side->>'videoId')::uuid FOR SHARE OF c;
   IF parent IS NOT NULL THEN keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;
  END IF;
  IF TG_TABLE_NAME='channel_feed' THEN
   SELECT to_jsonb(c) INTO parent FROM channel c JOIN program_block p ON p."channelId"=c.id WHERE p.id=(side->>'activeProgramBlockId')::uuid FOR SHARE OF c;
   IF parent IS NOT NULL THEN keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;
   SELECT to_jsonb(l) INTO ref FROM live_session l WHERE l.id=(side->>'activeLiveSessionId')::uuid FOR SHARE;
   IF ref IS NOT NULL THEN
    keys:=keys||ot_collect_deletion_fence_keys(ref,'[0:5]={startedByUserId,account,scalar,startedByProfileId,profile,scalar}'::text[]);
    SELECT to_jsonb(c) INTO parent FROM channel c WHERE c.id=(ref->>'channelId')::uuid FOR SHARE;
    IF parent IS NOT NULL THEN keys:=keys||ot_collect_deletion_fence_keys(parent,'[0:5]={userId,account,scalar,profileId,profile,scalar}'::text[]); END IF;
   END IF;
  END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT value FROM unnest(keys) AS value ORDER BY value LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
  SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;
  IF FOUND THEN ops:=array_append(ops,hit); END IF;
 END LOOP;
 IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $ot$;`;
  return {
    up: [
      ...shared.up,
      guard,
      ...tables.map(
        (table) =>
          `CREATE TRIGGER ot_videos_deletion_write_fence_${table} BEFORE INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION ot_videos_deletion_write_guard();`
      ),
    ],
    down: [
      ...tables
        .reverse()
        .map(
          (table) =>
            `DROP TRIGGER IF EXISTS ot_videos_deletion_write_fence_${table} ON "${table}";`
        ),
      'DROP FUNCTION IF EXISTS ot_videos_deletion_write_guard();',
      ...shared.down,
    ],
  };
}
