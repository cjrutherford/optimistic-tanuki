import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
export function workspaceDeletionFenceSql() {
  const shared = generateDeletionWriteFenceSql([]);
  const sql = `CREATE FUNCTION ot_workspace_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
 DECLARE body jsonb;sides jsonb[]:=ARRAY[]::jsonb[];keys text[]:=ARRAY[]::text[];k text;hit text;ops text[]:=ARRAY[]::text[];op text:=NULLIF(current_setting('ot.deletion_operation',true),'');
 BEGIN
 IF TG_OP<>'INSERT' THEN sides:=array_append(sides,to_jsonb(OLD));END IF;IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW));END IF;
 FOREACH body IN ARRAY sides LOOP
  IF op IS NULL AND body->>'ownerUserId'='00000000-0000-0000-0000-000000000000' THEN RAISE EXCEPTION 'WORKSPACE_DELETED_STEWARDSHIP';END IF;
  keys:=keys||ARRAY[ot_deletion_fence_key(body->>'ownerUserId','account'),ot_deletion_fence_key(body->>'ownerProfileId','profile')];
  IF body->>'sourceService'='app-configurator' THEN keys:=array_append(keys,ot_deletion_fence_key(body->>'sourceId','profile'));END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;
 IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;`;
  return {
    up: [
      ...shared.up,
      sql,
      'CREATE TRIGGER ot_workspace_deletion BEFORE INSERT OR UPDATE OR DELETE ON workspaces FOR EACH ROW EXECUTE FUNCTION ot_workspace_deletion_guard();',
    ],
    down: [
      'DROP TRIGGER IF EXISTS ot_workspace_deletion ON workspaces;',
      'DROP FUNCTION IF EXISTS ot_workspace_deletion_guard();',
      ...shared.down,
    ],
  };
}
