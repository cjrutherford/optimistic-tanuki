jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import loadDatabase from './loadDatabase';
import { validateForumDispositions } from './forum-account-export-dispositions';

describe('Forum account export dispositions J26', () => {
  let source: DataSource;
  const make = () =>
    new DataSource({
      ...(loadDatabase({ get: () => ({}) } as any) as any),
      type: 'postgres',
      synchronize: false,
    });
  const inventory = () =>
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'forum-account-export-dispositions.json'),
        'utf8'
      )
    );
  beforeAll(async () => {
    source = make();
    await (source as any).buildMetadatas();
  });
  it('validates the checked-in inventory against loadDatabase entity registration', () => {
    const metas = source.entityMetadatas,
      policy = inventory();
    expect(validateForumDispositions(metas, policy)).toEqual([]);
    expect(metas.filter((m) => m.tableType !== 'junction')).toHaveLength(7);
    expect(metas.filter((m) => m.tableType === 'junction')).toHaveLength(1);
    const staticText = fs.readFileSync(
      path.join(__dirname, 'staticDatabase.ts'),
      'utf8'
    );
    const registration = staticText.match(/const entities = \[([\s\S]*?)\];/);
    expect(registration).not.toBeNull();
    const names = registration![1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    expect(names.sort()).toEqual(
      metas
        .filter((m) => m.tableType !== 'junction')
        .map((m) => m.name)
        .sort()
    );
  });
  it('rejects field, selector, source, store and association drift', () => {
    const metas = source.entityMetadatas,
      policy = inventory();
    const missing = structuredClone(policy);
    missing.entities[0].columns[0].fields = [];
    expect(
      validateForumDispositions(metas, missing).some((e) => e.includes('omits'))
    ).toBe(true);
    const wrongIdentity = structuredClone(policy);
    wrongIdentity.entities.find(
      (e: any) => e.name === 'ForumPost'
    ).subject.fields = ['userId'];
    expect(
      validateForumDispositions(metas, wrongIdentity).some((e) =>
        e.includes('subject selector mismatch')
      )
    ).toBe(true);
    const exposed = structuredClone(policy);
    exposed.entities
      .find((e: any) => e.name === 'ForumReport')
      .columns.find((g: any) => g.fields.includes('adminNotes')).action =
      'include-owned';
    expect(
      validateForumDispositions(metas, exposed).some((e) =>
        e.includes('private/governance')
      )
    ).toBe(true);
    const wrongDomain = structuredClone(policy);
    wrongDomain.entities.find(
      (e: any) => e.name === 'ForumReport'
    ).subject.kind = 'account';
    expect(
      validateForumDispositions(metas, wrongDomain).some((e) =>
        e.includes('subject selector mismatch')
      )
    ).toBe(true);
    const duplicate = structuredClone(policy);
    duplicate.entities[0].columns.push(duplicate.entities[0].columns[0]);
    expect(
      validateForumDispositions(metas, duplicate).some((e) =>
        e.includes('duplicates')
      )
    ).toBe(true);
    const missingStore = structuredClone(policy);
    missingStore.stores.pop();
    expect(
      validateForumDispositions(metas, missingStore).some((e) =>
        e.includes('missing store')
      )
    ).toBe(true);
    const unsafe = structuredClone(policy);
    unsafe.entities[0].source = '../private';
    expect(
      validateForumDispositions(metas, unsafe).some((e) =>
        e.includes('invalid source')
      )
    ).toBe(true);
    const extra = structuredClone(policy);
    extra.stores.push({ ...extra.stores[0], name: 'unreviewed-table' });
    expect(
      validateForumDispositions(metas, extra).some((e) =>
        e.includes('unreviewed store')
      )
    ).toBe(true);
    const badAssociation = structuredClone(policy);
    badAssociation.associations[0].columnNames = ['secret'];
    expect(
      validateForumDispositions(metas, badAssociation).some((e) =>
        e.includes('columnNames mismatch')
      )
    ).toBe(true);
    const catalog = metas
      .filter((m) => m.tableType !== 'junction')
      .map((m) => ({
        table: m.tableName,
        columns: m.columns.map((c) => c.databaseName),
      }))
      .concat(
        metas
          .filter((m) => m.tableType === 'junction')
          .map((m) => ({
            table: m.tableName,
            columns: m.columns.map((c) => c.databaseName),
          })),
        [{ table: 'unreviewed', columns: ['secret'] }]
      );
    expect(
      validateForumDispositions(metas, policy, catalog).some((e) =>
        e.includes('unaccounted')
      )
    ).toBe(true);
  });
});
