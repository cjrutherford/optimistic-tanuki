jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import loadDatabase from './loadDatabase';
import { validateWorkspaceDispositions } from './workspace-account-export-dispositions';

describe('Workspace account export dispositions O01-P', () => {
  let source: DataSource;
  const inventory = () =>
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'workspace-account-export-dispositions.json'),
        'utf8'
      )
    );
  beforeAll(async () => {
    source = new DataSource({
      ...(loadDatabase({ get: () => ({}) } as any) as any),
      type: 'postgres',
      synchronize: false,
    });
    await (source as any).buildMetadatas();
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
  });

  it('validates the actual loadDatabase registration and all 12 Workspace columns', () => {
    const metadata = source.entityMetadatas;
    expect(validateWorkspaceDispositions(metadata, inventory())).toEqual([]);
    expect(metadata).toHaveLength(2);
    expect(
      metadata
        .find((item) => item.name === 'Workspace')!
        .columns.map((column) => column.databaseName)
    ).toHaveLength(12);
    expect(
      metadata.find((item) => item.name === 'Workspace')!.relations
    ).toHaveLength(0);
    expect(metadata.find((item) => item.name === 'Workspace')!.tableName).toBe(
      'workspaces'
    );
  });

  it('rejects metadata, association, selector, exclusion, store, source and physical catalog drift', () => {
    const metadata = source.entityMetadatas;
    const changed = (edit: (value: any) => void) => {
      const value = inventory();
      edit(value);
      return value;
    };
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => v.entities[0].columns[0].fields.pop())
      ).some((error) => error.includes('omits'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => (v.entities[0].subject.fields = ['ownerUserId']))
      ).some((error) => error.includes('subject selector mismatch'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => (v.selection.selector.operator = 'OR'))
      ).some((error) => error.includes('selection policy mismatch'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => (v.selection.selector.profileSet = 'historicalProfiles'))
      ).some((error) => error.includes('selection policy mismatch'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed(
          (v) =>
            (v.entities[0].columns.find((g: any) =>
              g.fields.includes('sourceId')
            ).action = 'include-owned')
        )
      ).some((error) => error.includes('policy mismatch'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) =>
          v.associations.push({
            name: 'unexpected',
            source: 'apps/workspace/src/entities/workspace.entity.ts',
          })
        )
      ).some((error) => error.includes('unexpected association'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => v.stores.pop())
      ).some((error) => error.includes('missing store'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed(
          (v) =>
            (v.stores.find(
              (store: any) => store.name === 'Workspace.configurationInputs'
            ).columns[0].action = 'include-owned')
        )
      ).some((error) => error.includes('store field policy mismatch'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => {
          const store = v.stores.find(
            (item: any) => item.name === 'typeorm_migrations_store'
          );
          store.kind = 'external';
          store.table = undefined;
        })
      ).some((error) => error.includes('store disposition mismatch'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        metadata,
        changed((v) => (v.entities[0].source = '../unsafe'))
      ).some((error) => error.includes('invalid source'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(metadata, inventory(), [
        {
          table: 'workspaces',
          columns: metadata
            .find((item) => item.name === 'Workspace')!
            .columns.map((c) => c.databaseName),
        },
        { table: 'surprise', columns: ['secret'] },
      ]).some((error) => error.includes('unaccounted'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(metadata, inventory(), [
        {
          table: 'workspaces',
          columns: metadata
            .find((item) => item.name === 'Workspace')!
            .columns.map((c) => c.databaseName),
        },
      ]).some((error) => error.includes('physical table missing migrations'))
    ).toBe(true);
    const wrongMigrationKind = changed((v) => {
      v.stores.find(
        (store: any) => store.name === 'typeorm_migrations_store'
      ).kind = 'external';
    });
    expect(
      validateWorkspaceDispositions(metadata, wrongMigrationKind, [
        {
          table: 'workspaces',
          columns: metadata
            .find((item) => item.name === 'Workspace')!
            .columns.map((c) => c.databaseName),
        },
      ]).some((error) => error.includes('physical table missing migrations'))
    ).toBe(true);
    expect(
      validateWorkspaceDispositions(
        [...metadata, metadata.find((item) => item.name === 'Workspace')!],
        inventory()
      ).some((error) => error.includes('duplicate entity'))
    ).toBe(true);
    const duplicateColumn = metadata.map((item) => ({
      name: item.name,
      tableName: item.tableName,
      columns: [...item.columns, item.columns[0]],
      relations: [...item.relations],
    }));
    expect(
      validateWorkspaceDispositions(duplicateColumn as any, inventory()).some(
        (error) => error.includes('duplicate column')
      )
    ).toBe(true);
    const relationDrift = metadata.map((item) => ({
      name: item.name,
      tableName: item.tableName,
      columns: [...item.columns],
      relations: [...item.relations, { propertyName: 'member' }],
    }));
    expect(
      validateWorkspaceDispositions(relationDrift as any, inventory()).some(
        (error) => error.includes('relations are prohibited')
      )
    ).toBe(true);
    const duplicateStore = changed((v) => v.stores.push(v.stores[0]));
    expect(
      validateWorkspaceDispositions(metadata, duplicateStore).some((error) =>
        error.includes('duplicate')
      )
    ).toBe(true);
    const duplicateTable = metadata.find(
      (item) => item.name === 'Workspace'
    )!.tableName;
    expect(
      validateWorkspaceDispositions(metadata, inventory(), [
        {
          table: duplicateTable,
          columns: metadata
            .find((item) => item.name === 'Workspace')!
            .columns.map((c) => c.databaseName),
        },
        {
          table: duplicateTable,
          columns: metadata
            .find((item) => item.name === 'Workspace')!
            .columns.map((c) => c.databaseName),
        },
        { table: 'migrations', columns: ['id', 'timestamp', 'name'] },
      ]).some((error) => error.includes('duplicate physical table'))
    ).toBe(true);
  });
});
