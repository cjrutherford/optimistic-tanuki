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
    entities: [ClassifiedAdEntity],
  });
  await (ds as any).buildMetadatas();
  return ds.entityMetadatas;
};

it('covers the actual registered ORM columns and relations offline', async () => {
  const actual = await metadata();
  expect(actual).toHaveLength(1);
  expect(actual[0].columns).toHaveLength(18);
  expect(actual[0].relations).toEqual([]);
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
    validateClassifiedsDispositions([{ ...actual[0], tableName: 'other' }])
  ).toContain('ClassifiedAdEntity metadata drift');
  const catalog = [
    {
      table: 'classified_ad',
      columns: actual[0].columns.map((c) => c.databaseName),
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
