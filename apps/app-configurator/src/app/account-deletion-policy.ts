import { generateDeletionWriteFenceSql } from '@optimistic-tanuki/storage';
export const APP_CONFIGURATOR_DELETION_IDENTITIES: Readonly<
  Record<string, readonly (readonly [string, 'account' | 'profile'])[]>
> = {
  app_configuration_entity: [
    ['ownerUserId', 'account'],
    ['ownerProfileId', 'profile'],
  ],
  app_instances: [
    ['ownerUserId', 'account'],
    ['ownerProfileId', 'profile'],
  ],
  app_memberships: [
    ['userId', 'account'],
    ['profileId', 'profile'],
  ],
};
export function appConfiguratorDeletionFenceSql() {
  const shared = generateDeletionWriteFenceSql([]);
  const cases = Object.entries(APP_CONFIGURATOR_DELETION_IDENTITIES)
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
  const sql = `CREATE FUNCTION ot_app_configurator_identity_keys(t text,body jsonb) RETURNS text[] LANGUAGE plpgsql AS $ot$ BEGIN CASE t ${cases} ELSE RAISE EXCEPTION 'APP_CONFIGURATOR_DELETION_UNKNOWN_TABLE';END CASE;END $ot$;
 CREATE FUNCTION ot_app_configurator_deletion_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$
 DECLARE body jsonb;ref jsonb;sides jsonb[]:=ARRAY[]::jsonb[];keys text[]:=ARRAY[]::text[];k text;hit text;ops text[]:=ARRAY[]::text[];op text:=NULLIF(current_setting('ot.deletion_operation',true),'');
 BEGIN
 IF TG_OP<>'INSERT' THEN sides:=array_append(sides,to_jsonb(OLD));END IF;IF TG_OP<>'DELETE' THEN sides:=array_append(sides,to_jsonb(NEW));END IF;
 FOREACH body IN ARRAY sides LOOP
  IF op IS NULL AND TG_TABLE_NAME='app_instances' AND (body->>'ownerUserId'='00000000-0000-0000-0000-000000000000' OR body->>'ownerProfileId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'APP_CONFIGURATOR_DELETED_STEWARDSHIP';END IF;
  keys:=keys||ot_app_configurator_identity_keys(TG_TABLE_NAME,body);
  IF TG_TABLE_NAME IN ('app_configuration_entity','app_memberships') THEN
   SELECT to_jsonb(p) INTO ref FROM app_instances p WHERE p.id::text=lower(btrim(body->>'appInstanceId')) AND p."workspaceId"::text=lower(btrim(body->>'workspaceId')) AND p."appScope"=body->>'appScope' FOR SHARE;
   IF ref IS NOT NULL THEN keys:=keys||ot_app_configurator_identity_keys('app_instances',ref);
    IF op IS NULL AND TG_OP<>'DELETE' AND TG_TABLE_NAME='app_configuration_entity' AND (ref->>'ownerUserId'='00000000-0000-0000-0000-000000000000' OR ref->>'ownerProfileId'='00000000-0000-0000-0000-000000000000') THEN RAISE EXCEPTION 'APP_CONFIGURATOR_DELETED_CONFIGURATION';END IF;
   END IF;
  END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT x FROM unnest(keys) x WHERE x IS NOT NULL ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k,0));SELECT "operationId"::text INTO hit FROM account_deletion_write_fence WHERE "key"=k;IF FOUND THEN ops:=array_append(ops,hit);END IF;END LOOP;
 IF cardinality(ops)>0 AND (op IS NULL OR NOT(op=ANY(ops))) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACCOUNT_DELETION_FENCED';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $ot$;`;
  const tables = Object.keys(APP_CONFIGURATOR_DELETION_IDENTITIES);
  return {
    up: [
      ...shared.up,
      sql,
      ...tables.map(
        (table) =>
          `CREATE TRIGGER ot_app_configurator_deletion_${table} BEFORE INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION ot_app_configurator_deletion_guard();`
      ),
    ],
    down: [
      ...tables.map(
        (table) =>
          `DROP TRIGGER IF EXISTS ot_app_configurator_deletion_${table} ON "${table}";`
      ),
      'DROP FUNCTION IF EXISTS ot_app_configurator_deletion_guard();',
      'DROP FUNCTION IF EXISTS ot_app_configurator_identity_keys(text,jsonb);',
      ...shared.down,
    ],
  };
}
