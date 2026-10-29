import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
/** Profile UUIDs only. Parent participation serializes message writers with erasure. */
export function chatDeletionFenceSql() {
  const shared = generateDeletionWriteFenceSql([]);
  return {
    up: [
      ...shared.up,
      `CREATE FUNCTION ot_chat_keys(t text,b jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$
    DECLARE ids text[]; v text; keys text[]:=ARRAY[]::text[]; BEGIN
    IF t='conversation' THEN ids:=ARRAY[b->>'ownerId']||ARRAY(SELECT jsonb_array_elements_text(b->'participants'));
    ELSIF t='message' THEN ids:=ARRAY[b->>'senderId']||ARRAY(SELECT jsonb_array_elements_text(b->'recipients'));
    ELSE RAISE EXCEPTION 'CHAT_DELETION_UNKNOWN_TABLE'; END IF;
    FOREACH v IN ARRAY ids LOOP keys:=array_append(keys,ot_deletion_fence_key(btrim(v),'profile')); END LOOP;RETURN keys;END $ot$;
    CREATE FUNCTION ot_chat_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
    DECLARE sides jsonb[]:=ARRAY[]::jsonb[]; b jsonb; p jsonb; keys text[]:=ARRAY[]::text[]; k text; hit text; ops text[]:=ARRAY[]::text[]; op text:=NULLIF(current_setting('ot.deletion_operation',true),'');
    BEGIN
    IF TG_OP<>'INSERT' THEN sides:=array_append(sides,to_jsonb(OLD));END IF;
    IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW));END IF;
    FOREACH b IN ARRAY sides LOOP
      keys:=keys||ot_chat_keys(TG_TABLE_NAME,b);
      IF TG_TABLE_NAME='message' THEN SELECT to_jsonb(c) INTO p FROM conversation c WHERE c.id::text=b->>'conversationId' FOR SHARE;
        IF p IS NOT NULL THEN keys:=keys||ot_chat_keys('conversation',p);END IF;
      END IF;
    END LOOP;
    FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;
      IF FOUND THEN ops:=array_append(ops,hit);END IF;
    END LOOP;
    IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;
    IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;`,
      ...['conversation', 'message'].map(
        (t) =>
          `CREATE TRIGGER ot_chat_deletion_${t} BEFORE INSERT OR UPDATE OR DELETE ON "${t}" FOR EACH ROW EXECUTE FUNCTION ot_chat_deletion_guard();`
      ),
    ],
    down: [
      ...['message', 'conversation'].map(
        (t) => `DROP TRIGGER IF EXISTS ot_chat_deletion_${t} ON "${t}";`
      ),
      'DROP FUNCTION IF EXISTS ot_chat_deletion_guard();',
      'DROP FUNCTION IF EXISTS ot_chat_keys(text,jsonb);',
      ...shared.down,
    ],
  };
}
