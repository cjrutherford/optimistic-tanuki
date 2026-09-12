import { DataSource, EntityMetadata, getMetadataArgsStorage } from 'typeorm';
import staticDatabase from '../../app/staticDatabase';
import loadDatabase from '../../app/loadDatabase';
import { AppConfigurationEntity } from './app-configuration.entity';
import { AppInstanceEntity } from './app-instance.entity';
import { AppMembershipEntity } from './app-membership.entity';

describe('app-configurator TypeORM metadata', () => {
  let metadataSource: DataSource;

  beforeAll(async () => {
    metadataSource = new DataSource({
      ...staticDatabase.options,
      migrations: [],
    });
    await (
      metadataSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
  });

  afterAll(async () => {
    if (metadataSource?.isInitialized) {
      await metadataSource.destroy();
    }
  });

  function entityMetadata(name: string): EntityMetadata {
    const metadata = metadataSource.entityMetadatas.find(
      (candidate) => candidate.name === name
    );
    if (!metadata) {
      throw new Error(`Missing metadata for ${name}`);
    }
    return metadata;
  }

  function columnNames(name: string): string[] {
    return entityMetadata(name).columns.map((column) => column.propertyName);
  }

  function uniqueIndexColumns(name: string): string[][] {
    return entityMetadata(name)
      .indices.filter((index) => index.isUnique)
      .map((index) => index.columns.map((column) => column.propertyName));
  }

  function foreignKeyColumns(name: string): Array<{
    columns: string[];
    referencedEntity: string;
    referencedColumns: string[];
  }> {
    return entityMetadata(name).foreignKeys.map((foreignKey) => ({
      columns: foreignKey.columns.map((column) => column.propertyName),
      referencedEntity: foreignKey.referencedEntityMetadata.name,
      referencedColumns: foreignKey.referencedColumns.map(
        (column) => column.propertyName
      ),
    }));
  }

  it('scopes configurations to an app instance while retaining compatibility fields and global domains', () => {
    const metadata = entityMetadata(AppConfigurationEntity.name);

    expect(columnNames(AppConfigurationEntity.name)).toEqual(
      expect.arrayContaining([
        'workspaceId',
        'appInstanceId',
        'ownerUserId',
        'ownerProfileId',
        'appScope',
      ])
    );
    expect(uniqueIndexColumns(AppConfigurationEntity.name)).toContainEqual([
      'appInstanceId',
      'name',
    ]);
    const domainColumn = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === AppConfigurationEntity &&
        column.propertyName === 'domain'
    );
    expect(domainColumn?.options.unique).toBe(true);
  });

  it('maps app instances to UUID identities, lifecycle metadata, and workspace uniqueness', () => {
    const metadata = entityMetadata('AppInstanceEntity');
    const columns = Object.fromEntries(
      metadata.columns.map((column) => [column.propertyName, column])
    );

    expect(columns.id.isGenerated).toBe(true);
    expect(columns.id.generationStrategy).toBe('uuid');
    expect(columns.workspaceId.type).toBe('uuid');
    expect(columns.ownerUserId.type).toBe('uuid');
    expect(columns.ownerProfileId.type).toBe('uuid');
    expect(columns.appScope.type).toBe('varchar');
    expect(columns.status.enum).toEqual([
      'pending',
      'active',
      'suspended',
      'revoked',
    ]);
    expect(columns.createdAt.isCreateDate).toBe(true);
    expect(columns.updatedAt.isUpdateDate).toBe(true);
    expect(uniqueIndexColumns('AppInstanceEntity')).toContainEqual([
      'workspaceId',
    ]);
    expect(uniqueIndexColumns('AppInstanceEntity')).toContainEqual([
      'id',
      'workspaceId',
      'appScope',
    ]);
  });

  it('maps memberships to app instances and profile uniqueness with P1 roles and statuses', () => {
    const metadata = entityMetadata('AppMembershipEntity');
    const columns = Object.fromEntries(
      metadata.columns.map((column) => [column.propertyName, column])
    );

    expect(columns.id.isGenerated).toBe(true);
    expect(columns.id.generationStrategy).toBe('uuid');
    expect(columns.workspaceId.type).toBe('uuid');
    expect(columns.appInstanceId.type).toBe('uuid');
    expect(columns.userId.type).toBe('uuid');
    expect(columns.profileId.type).toBe('uuid');
    expect(columns.appScope.type).toBe('varchar');
    expect(columns.role.enum).toEqual([
      'owner',
      'admin',
      'moderator',
      'member',
    ]);
    expect(columns.status.enum).toEqual([
      'pending',
      'active',
      'denied',
      'suspended',
      'revoked',
    ]);
    expect(columns.createdAt.isCreateDate).toBe(true);
    expect(columns.updatedAt.isUpdateDate).toBe(true);
    expect(uniqueIndexColumns('AppMembershipEntity')).toContainEqual([
      'appInstanceId',
      'profileId',
    ]);
  });

  it('enforces app instance workspace and scope consistency in configuration and membership foreign keys', () => {
    expect(foreignKeyColumns(AppConfigurationEntity.name)).toContainEqual({
      columns: ['appInstanceId', 'workspaceId', 'appScope'],
      referencedEntity: AppInstanceEntity.name,
      referencedColumns: ['id', 'workspaceId', 'appScope'],
    });
    expect(foreignKeyColumns(AppMembershipEntity.name)).toContainEqual({
      columns: ['appInstanceId', 'workspaceId', 'appScope'],
      referencedEntity: AppInstanceEntity.name,
      referencedColumns: ['id', 'workspaceId', 'appScope'],
    });
  });

  it('registers app instance and membership entities in runtime and CLI datasources', () => {
    const staticEntityNames = (
      (staticDatabase.options.entities ?? []) as Function[]
    ).map((entity) => (entity as Function).name);
    const runtimeDatabase = loadDatabase();
    const runtimeEntityNames = (
      (runtimeDatabase.entities ?? []) as Function[]
    ).map((entity) => (entity as Function).name);

    expect(staticEntityNames).toEqual(
      expect.arrayContaining(['AppInstanceEntity', 'AppMembershipEntity'])
    );
    expect(runtimeEntityNames).toEqual(
      expect.arrayContaining(['AppInstanceEntity', 'AppMembershipEntity'])
    );
  });
});
