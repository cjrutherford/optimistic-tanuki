jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import loadDatabase from './loadDatabase';
import inventory from './social-account-export-dispositions.json';
import { validateSocialDispositions } from './social-account-export-dispositions';

describe('Social account export disposition contract', () => {
  let source: DataSource;
  const clone = () => JSON.parse(JSON.stringify(inventory));
  beforeAll(async () => {
    source = new DataSource(loadDatabase({ get: () => ({}) } as any) as any);
    await (source as any).buildMetadatas();
  });
  const validate = (policy: unknown) =>
    validateSocialDispositions(source.entityMetadatas, policy);
  it('accounts for all 34 registered entities including the excluded operational fence and the actual junction metadata', () => {
    expect(
      source.entityMetadatas.filter((m) => m.tableType !== 'junction')
    ).toHaveLength(34);
    expect(
      source.entityMetadatas.filter((m) => m.tableType === 'junction')
    ).toHaveLength(1);
    expect(validate(inventory)).toEqual([]);
  });
  it('rejects missing, duplicate and extra field declarations', () => {
    const missing = clone();
    missing.entities[0].columns[0].fields.pop();
    expect(validate(missing).some((e) => e.includes('omits'))).toBe(true);
    const duplicate = clone();
    duplicate.entities[0].columns[0].fields.push(
      duplicate.entities[0].columns[0].fields[0]
    );
    expect(validate(duplicate).some((e) => e.includes('duplicates'))).toBe(
      true
    );
    const extra = clone();
    extra.entities[0].columns[0].fields.push('unreviewedSecret');
    expect(validate(extra).some((e) => e.includes('extra'))).toBe(true);
  });
  it('rejects unsafe sources, missing handling actions and unsubstantiated legacy certainty', () => {
    const bad = clone();
    bad.entities[0].columns[0].evidence = ['/private/operator-config'];
    expect(
      validate(bad).some((e) => e.includes('safe relative evidence'))
    ).toBe(true);
    const action = clone();
    delete action.entities[0].columns[0].action;
    expect(validate(action).some((e) => e.includes('invalid action'))).toBe(
      true
    );
    const legacy = clone();
    legacy.entities[0].subject.legacyProvenance =
      'All authorship and consent verified';
    expect(validate(legacy).some((e) => e.includes('legacy uncertainty'))).toBe(
      true
    );
  });
  it('rejects junction policies that omit or self-declare unrelated columns', () => {
    const missing = clone();
    missing.associations = [];
    expect(
      validate(missing).some((e) => e.includes('missing association'))
    ).toBe(true);
    const forged = clone();
    forged.associations[0].columnNames = ['secret'];
    expect(
      validate(forged).some((e) => e.includes('columnNames mismatch'))
    ).toBe(true);
  });
  it('rejects missing known stores and invented stores without a reviewed contract', () => {
    const missing = clone();
    missing.stores = missing.stores.filter((s: any) => s.kind !== 'volatile');
    expect(validate(missing).some((e) => e.includes('missing store'))).toBe(
      true
    );
    const extra = clone();
    extra.stores.push({ ...extra.stores[0], name: 'unknown-personal-cache' });
    expect(validate(extra).some((e) => e.includes('unreviewed store'))).toBe(
      true
    );
  });
  it('rejects physical table/column drift and duplicated catalog entries', () => {
    const tables = source.entityMetadatas.map((m) => ({
      table: m.tableName,
      columns: m.columns.map((c) => c.databaseName),
    }));
    tables.push({ table: 'migrations', columns: ['id', 'timestamp', 'name'] });
    expect(
      validateSocialDispositions(source.entityMetadatas, inventory, tables)
    ).toEqual([]);
    expect(
      validateSocialDispositions(source.entityMetadatas, inventory, [
        ...tables,
        { table: 'unknown_private_store', columns: ['secret'] },
      ]).length
    ).toBeGreaterThan(0);
    expect(
      validateSocialDispositions(source.entityMetadatas, inventory, [
        ...tables,
        tables[0],
      ]).some((e) => e.includes('duplicate physical'))
    ).toBe(true);
  });
  it('keeps identity domains and sensitive-field exclusions explicit', () => {
    const entities = new Map(inventory.entities.map((e) => [e.name, e]));
    expect(entities.get('PostShare')!.subject.kind).toBe('profile');
    expect(entities.get('ContentReport')!.subject.kind).toBe('profile');
    expect(entities.get('UserPresence')!.subject.kind).toBe('account');
    expect(entities.get('ProfileView')!.subject.kind).toBe('viewer-account');
    const action = (name: string, field: string) =>
      entities.get(name)!.columns.find((g) => g.fields.includes(field))!.action;
    for (const field of ['senderId', 'resourceId', 'resourceType', 'actionUrl'])
      expect(action('Notification', field)).toBe('exclude');
    for (const field of ['token', 'inviteeEmail'])
      expect(action('CommunityInvite', field)).toBe('exclude');
    expect(action('Attachment', 'filePath')).toBe('exclude');
    expect(action('Poll', 'votes')).toBe('exclude');
    expect(action('SavedItem', 'itemTitle')).toBe('exclude');
    expect(action('GuardianContentAudit', 'changedFields')).toBe('exclude');
    expect(action('ContentModerationAction', 'details')).toBe('exclude');
  });
  it('has real checked-in source evidence for every policy group and selector', () => {
    const root = path.resolve(__dirname, '../../../..');
    for (const entry of [
      ...inventory.entities,
      ...inventory.associations,
      ...inventory.stores,
    ]) {
      expect(fs.existsSync(path.join(root, entry.source))).toBe(true);
      for (const group of [
        ...entry.columns,
        ...('relations' in entry ? entry.relations : []),
      ])
        for (const evidence of group.evidence)
          expect(fs.existsSync(path.join(root, evidence))).toBe(true);
      if ('subject' in entry)
        for (const evidence of entry.subject.evidence)
          expect(fs.existsSync(path.join(root, evidence))).toBe(true);
    }
  });
});
