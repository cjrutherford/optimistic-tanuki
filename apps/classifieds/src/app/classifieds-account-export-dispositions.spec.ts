import { AccountDeletionWriteFenceEntity } from '@optimistic-tanuki/storage';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
import {
  CLASSIFIEDS_ACCOUNT_EXPORT_INVENTORY,
  validateClassifiedsDispositions,
} from './classifieds-account-export-dispositions';

const metadata = async () => {
  const ds = new DataSource({
    type: 'postgres',
    entities: [ClassifiedAdEntity, AccountDeletionWriteFenceEntity],
  });
  await (ds as any).buildMetadatas();
  return ds.entityMetadatas;
};

it('covers the actual registered ORM columns and relations offline', async () => {
  const actual = await metadata();
  expect(actual).toHaveLength(2);
  expect(
    actual.find((e) => e.name === 'ClassifiedAdEntity')!.columns
  ).toHaveLength(18);
  expect(
    actual.find((e) => e.name === 'ClassifiedAdEntity')!.relations
  ).toEqual([]);
  expect(validateClassifiedsDispositions(actual)).toEqual([]);
  expect(
    CLASSIFIEDS_ACCOUNT_EXPORT_INVENTORY.entities[0].columns.flatMap(
      (group) => group.fields
    )
  ).toHaveLength(18);
});

it('rejects entity and complete physical-catalog drift', async () => {
  const actual = await metadata();
  expect(
    validateClassifiedsDispositions(
      actual.map((e) =>
        e.name === 'ClassifiedAdEntity' ? { ...e, tableName: 'other' } : e
      )
    )
  ).toContain('ClassifiedAdEntity metadata drift');
  const catalog = [
    {
      table: 'account_deletion_write_fence',
      columns: ['key', 'kind', 'operationId', 'installedAt'],
    },
    {
      table: 'classified_ad',
      columns: actual
        .find((e) => e.name === 'ClassifiedAdEntity')!
        .columns.map((c) => c.databaseName),
    },
    { table: 'migrations', columns: ['id', 'timestamp', 'name'] },
  ];
  expect(validateClassifiedsDispositions(actual, undefined, catalog)).toEqual(
    []
  );
  expect(
    validateClassifiedsDispositions(actual, undefined, [
      ...catalog,
      { table: 'unreviewed_store', columns: ['secret'] },
    ])
  ).toContain('physical table catalog drift');
});

it('fails closed on malformed or weakened subject/store policies', async () => {
  const actual = await metadata();
  for (const mutate of [
    (x: any) => {
      x.stores[1] = x.stores[0];
    },
    (x: any) => {
      x.stores[0].fields = ['secret'];
    },
    (x: any) => {
      x.stores[0].evidence = ['../secret'];
    },
    (x: any) => {
      x.entities[0].columns = null;
    },
    (x: any) => {
      x.selection.selector.profileBinding = 'skip unproven rows';
    },
    (x: any) => {
      x.selection.selector.appScopes = ['local-hub', 'other-product'];
    },
  ]) {
    const copy = JSON.parse(
      JSON.stringify(CLASSIFIEDS_ACCOUNT_EXPORT_INVENTORY)
    );
    mutate(copy);
    expect(() => validateClassifiedsDispositions(actual, copy)).not.toThrow();
    expect(
      validateClassifiedsDispositions(actual, copy).length
    ).toBeGreaterThan(0);
  }
});

it('rejects malformed or missing operational fence metadata without throwing', async () => {
  const actual = await metadata();
  expect(validateClassifiedsDispositions(null as never)).toEqual([
    'invalid inventory shape',
  ]);
  expect(
    validateClassifiedsDispositions(
      actual.filter((e) => e.name !== 'AccountDeletionWriteFenceEntity')
    )
  ).toContain('operational fence drift');
  expect(
    validateClassifiedsDispositions(
      actual.map((e) =>
        e.name === 'AccountDeletionWriteFenceEntity'
          ? { ...e, columns: null }
          : e
      )
    )
  ).toContain('operational fence drift');
});
