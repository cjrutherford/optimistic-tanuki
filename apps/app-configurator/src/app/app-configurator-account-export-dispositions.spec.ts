import { DataSource } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import {
  APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
  validateAppConfiguratorDispositions,
} from './app-configurator-account-export-dispositions';

const source = () =>
  new DataSource({
    type: 'postgres',
    entities: [AppConfigurationEntity, AppInstanceEntity, AppMembershipEntity],
  });
const policy = () =>
  JSON.parse(JSON.stringify(APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY));
const physical = (metadata: any[]) =>
  metadata.map((x) => ({
    table: x.tableName,
    columns: x.columns.map((c: any) => c.databaseName),
  }));
const buildMetadata = async (ds: DataSource) =>
  (ds as unknown as { buildMetadatas: () => Promise<void> }).buildMetadatas();

describe('App Configurator disposition policy', () => {
  it('accepts all four physical tables and rejects malformed inventories and undeclared stores', async () => {
    const ds = source();
    await buildMetadata(ds);
    const catalog = [
      ...physical(ds.entityMetadatas),
      { table: 'migrations', columns: ['id', 'timestamp', 'name'] },
    ];
    expect(
      validateAppConfiguratorDispositions(ds.entityMetadatas, policy(), catalog)
    ).toEqual([]);
    expect(
      validateAppConfiguratorDispositions(ds.entityMetadatas, policy(), [
        ...catalog,
        { table: 'unknown_store', columns: ['id'] },
      ]).length
    ).toBeGreaterThan(0);
    expect(
      validateAppConfiguratorDispositions(ds.entityMetadatas, {
        ...policy(),
        entities: [null],
      }).length
    ).toBeGreaterThan(0);
    expect(
      validateAppConfiguratorDispositions(ds.entityMetadatas, {
        ...policy(),
        stores: [null],
      }).length
    ).toBeGreaterThan(0);
  });
  it('uses actual TypeORM metadata without connecting and accepts recorded selector and parent proofs', async () => {
    const ds = source();
    try {
      await buildMetadata(ds);
      const errors = validateAppConfiguratorDispositions(
        ds.entityMetadatas,
        APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY
      );
      expect(errors).not.toContain(
        'AppConfigurationEntity subject selector drift'
      );
      expect(errors).not.toContain('AppInstanceEntity subject selector drift');
      expect(errors).not.toContain(
        'AppMembershipEntity subject selector drift'
      );
      expect(errors).not.toContain(
        'AppConfigurationEntity composite relation policy drift'
      );
      expect(errors).not.toContain(
        'AppMembershipEntity composite relation policy drift'
      );
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  });

  it('detects extra and duplicate entity/store inventory entries', async () => {
    const ds = source();
    await buildMetadata(ds);
    try {
      for (const mutate of [
        (p: any) => p.entities.push({ ...p.entities[0] }),
        (p: any) =>
          p.entities.push({ ...p.entities[0], name: 'UnexpectedEntity' }),
        (p: any) => p.stores.push({ ...p.stores[0] }),
      ]) {
        expect(
          validateAppConfiguratorDispositions(
            ds.entityMetadatas,
            mutate(policy())
          ).length
        ).toBeGreaterThan(0);
      }
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  });

  it('rejects selector, parent policy, store kind, and migration table drift', async () => {
    const ds = source();
    await buildMetadata(ds);
    try {
      const badSelector = policy();
      badSelector.entities[0].subject.selector.statusFilter = true;
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, badSelector)
      ).toContain('AppConfigurationEntity subject selector drift');
      const badParent = policy();
      badParent.entities[2].subject.parentPolicy =
        'composite-parent-and-recorded-owner-pair';
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, badParent)
      ).toContain('AppMembershipEntity subject selector drift');
      const badStore = policy();
      badStore.stores[0].table = 'other';
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, badStore)
      ).toContain('invalid store disposition typeorm_migrations_store');
      const badKind = policy();
      badKind.stores[1].kind = 'schema';
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, badKind)
      ).toContain('invalid store disposition processOutput');
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  });

  it('detects physical extra tables and exact migration columns', async () => {
    const ds = source();
    await buildMetadata(ds);
    try {
      const tables = physical(ds.entityMetadatas);
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, policy(), [
          ...tables,
          { table: 'unexpected', columns: ['id'] },
        ])
      ).toContain('unexpected physical table unexpected');
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, policy(), [
          ...tables,
          {
            table: 'typeorm_migrations_store',
            columns: ['id', 'timestamp', 'name', 'extra'],
          },
        ])
      ).toContain('migration physical columns drift');
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  });

  it('detects column, exclusion, evidence, and malformed nested policy drift', async () => {
    const ds = source();
    await buildMetadata(ds);
    try {
      const malformed = policy();
      malformed.entities[0].columns[0].fields.pop();
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, malformed)
      ).toContain('AppConfigurationEntity column policy drift');
      const excluded = policy();
      excluded.entities[0].columns[2].fields[0] = 'descriptionChanged';
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, excluded)
      ).toEqual(
        expect.arrayContaining([
          'configuration payload exclusions drift',
          'configuration payload exclusion details drift',
        ])
      );
      const unsafe = policy();
      unsafe.entities[0].subject.evidence = ['../secret'];
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, unsafe)
      ).toContain('AppConfigurationEntity subject selector drift');
      const nested = policy();
      nested.entities[0].columns = null;
      expect(() =>
        validateAppConfiguratorDispositions(ds.entityMetadatas, nested)
      ).not.toThrow();
      expect(
        validateAppConfiguratorDispositions(ds.entityMetadatas, nested).length
      ).toBeGreaterThan(0);
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  });
});
