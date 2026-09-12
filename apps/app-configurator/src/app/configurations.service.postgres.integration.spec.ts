import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AppConfigRequestContext,
  CreateAppConfigDto,
  LayoutType,
} from '@optimistic-tanuki/app-config-models';
import { randomUUID } from 'node:crypto';
import { DataSource, InsertQueryBuilder } from 'typeorm';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';

// The quality CI job does not provision PostgreSQL. Keep this live integration
// suite opt-in while retaining the existing POSTGRES_* connection overrides.
const postgresIntegrationSuite =
  process.env.RUN_APP_CONFIGURATOR_POSTGRES_INTEGRATION === 'true'
    ? describe
    : describe.skip;

const fixtureRunId = randomUUID();
const IDS = {
  workspace: randomUUID(),
  appInstance: randomUUID(),
  membership: randomUUID(),
  user: randomUUID(),
  profile: randomUUID(),
  foreignWorkspace: randomUUID(),
  foreignAppInstance: randomUUID(),
  foreignMembership: randomUUID(),
  foreignUser: randomUUID(),
  foreignProfile: randomUUID(),
} as const;

const ownerContext: AppConfigRequestContext = {
  ownerUserId: IDS.user,
  ownerProfileId: IDS.profile,
  appScope: 'business-site',
  workspaceId: IDS.workspace,
  appInstanceId: IDS.appInstance,
  membershipId: IDS.membership,
  membershipRole: 'owner',
  membershipStatus: 'active',
};

const foreignContext: AppConfigRequestContext = {
  ownerUserId: IDS.foreignUser,
  ownerProfileId: IDS.foreignProfile,
  appScope: 'business-site',
  workspaceId: IDS.foreignWorkspace,
  appInstanceId: IDS.foreignAppInstance,
  membershipId: IDS.foreignMembership,
  membershipRole: 'owner',
  membershipStatus: 'active',
};

const configurationDto: CreateAppConfigDto = {
  name: `Postgres integration proof ${fixtureRunId}`,
  description: 'A persisted integration-test configuration',
  domain: `postgres-integration-proof-${fixtureRunId}.example.com`,
  landingPage: {
    layout: 'single-column' satisfies LayoutType,
    sections: [],
  },
  routes: [],
  features: {},
  theme: {},
  manifest: {
    surfaceType: 'business-site',
    capabilities: {},
    schemaVersion: 1,
  },
  active: true,
};

const createdDataSources = new Set<DataSource>();

function createDataSource(): DataSource {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'db',
    port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
    username: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
    password:
      process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres',
    database:
      process.env.POSTGRES_DB ||
      process.env.DB_NAME ||
      'ot_app_configurator_p2_proof',
    entities: [AppConfigurationEntity, AppInstanceEntity, AppMembershipEntity],
    synchronize: false,
  });
  createdDataSources.add(dataSource);
  return dataSource;
}

function createService(dataSource: DataSource): ConfigurationsService {
  return new ConfigurationsService(
    dataSource.getRepository(AppConfigurationEntity),
    dataSource.getRepository(AppInstanceEntity),
    dataSource.getRepository(AppMembershipEntity),
    new Logger('ConfigurationsServicePostgresIntegration')
  );
}

postgresIntegrationSuite('ConfigurationsService with PostgreSQL', () => {
  let dataSource: DataSource;
  let reloadedDataSource: DataSource | undefined;
  let service: ConfigurationsService;

  beforeAll(async () => {
    dataSource = createDataSource();
    await dataSource.initialize();
    service = createService(dataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(AppConfigurationEntity).delete({
      appInstanceId: IDS.appInstance,
    });
    await dataSource.getRepository(AppMembershipEntity).delete({
      appInstanceId: IDS.appInstance,
    });
    await dataSource.getRepository(AppInstanceEntity).delete({
      id: IDS.appInstance,
    });
    await dataSource.getRepository(AppMembershipEntity).delete({
      appInstanceId: IDS.foreignAppInstance,
    });
    await dataSource.getRepository(AppInstanceEntity).delete({
      id: IDS.foreignAppInstance,
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.getRepository(AppConfigurationEntity).delete({
        appInstanceId: IDS.appInstance,
      });
      await dataSource.getRepository(AppMembershipEntity).delete({
        appInstanceId: IDS.appInstance,
      });
      await dataSource.getRepository(AppInstanceEntity).delete({
        id: IDS.appInstance,
      });
      await dataSource.getRepository(AppMembershipEntity).delete({
        appInstanceId: IDS.foreignAppInstance,
      });
      await dataSource.getRepository(AppInstanceEntity).delete({
        id: IDS.foreignAppInstance,
      });
    }
    for (const createdDataSource of createdDataSources) {
      if (createdDataSource.isInitialized) {
        await createdDataSource.destroy();
      }
    }
  });

  it('transactionally bootstraps and persists the owner app instance, membership, and configuration', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );

    expect(created.id).toBeDefined();
    expect(
      await dataSource.getRepository(AppInstanceEntity).findOneBy({
        id: IDS.appInstance,
      })
    ).toMatchObject({
      id: IDS.appInstance,
      workspaceId: IDS.workspace,
      status: 'active',
    });
    expect(
      await dataSource.getRepository(AppMembershipEntity).findOneBy({
        id: IDS.membership,
      })
    ).toMatchObject({
      id: IDS.membership,
      appInstanceId: IDS.appInstance,
      profileId: IDS.profile,
      role: 'owner',
      status: 'active',
    });
    expect(
      await dataSource.getRepository(AppConfigurationEntity).findOneBy({
        id: created.id,
      })
    ).toMatchObject({
      workspaceId: IDS.workspace,
      appInstanceId: IDS.appInstance,
      ownerProfileId: IDS.profile,
      name: configurationDto.name,
    });
  });

  it('returns one authoritative configuration for concurrent first-create bootstraps', async () => {
    const contenders = [createDataSource(), createDataSource()];
    await Promise.all(contenders.map((contender) => contender.initialize()));

    try {
      const [left, right] = contenders.map(createService);
      const [leftCreated, rightCreated] = await Promise.all([
        left.createConfiguration(configurationDto, ownerContext),
        right.createConfiguration(configurationDto, ownerContext),
      ]);

      expect(leftCreated.id).toBe(rightCreated.id);
      expect(
        await dataSource.getRepository(AppInstanceEntity).countBy({
          workspaceId: IDS.workspace,
        })
      ).toBe(1);
      expect(
        await dataSource.getRepository(AppMembershipEntity).countBy({
          appInstanceId: IDS.appInstance,
          profileId: IDS.profile,
        })
      ).toBe(1);
      expect(
        await dataSource.getRepository(AppConfigurationEntity).countBy({
          appInstanceId: IDS.appInstance,
          name: configurationDto.name,
        })
      ).toBe(1);
    } finally {
      await Promise.all(
        contenders.map(async (contender) => {
          if (contender.isInitialized) {
            await contender.destroy();
          }
        })
      );
    }
  });

  it('rejects a first-create payload that conflicts with the authoritative draft', async () => {
    await service.createConfiguration(configurationDto, ownerContext);

    await expect(
      service.createConfiguration(
        {
          ...configurationDto,
          description: 'Conflicting first-create payload',
        },
        ownerContext
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reloads the persisted configuration through a second DataSource and service', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );
    reloadedDataSource = createDataSource();
    await reloadedDataSource.initialize();

    const reloaded = await createService(reloadedDataSource).getConfiguration(
      created.id,
      ownerContext
    );

    expect(reloaded.id).toBe(created.id);
    expect(reloaded.name).toBe(configurationDto.name);
    expect(reloaded.workspaceId).toBe(IDS.workspace);
    expect(reloaded.appInstanceId).toBe(IDS.appInstance);
  });

  it('persists an updated draft and increments its revision across a second DataSource and service', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );

    const updated = await service.updateConfiguration(
      created.id,
      {
        expectedRevision: 1,
        description: 'Updated persisted integration-test draft',
      },
      ownerContext
    );
    if (reloadedDataSource?.isInitialized) {
      await reloadedDataSource.destroy();
    }
    reloadedDataSource = createDataSource();
    await reloadedDataSource.initialize();

    const reloaded = await createService(reloadedDataSource).getConfiguration(
      created.id,
      ownerContext
    );

    expect(updated.revision).toBe(2);
    expect(reloaded).toMatchObject({
      id: created.id,
      description: 'Updated persisted integration-test draft',
      revision: 2,
      release: expect.objectContaining({ status: 'draft' }),
    });
  });

  it('rejects a stale expected revision without changing the persisted draft or revision', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );
    await service.updateConfiguration(
      created.id,
      {
        expectedRevision: 1,
        description: 'Latest persisted integration-test draft',
      },
      ownerContext
    );

    await expect(
      service.updateConfiguration(
        created.id,
        {
          expectedRevision: 1,
          description: 'Rejected stale integration-test draft',
        },
        ownerContext
      )
    ).rejects.toBeInstanceOf(ConflictException);

    const persisted = await dataSource
      .getRepository(AppConfigurationEntity)
      .findOneBy({ id: created.id });

    expect(persisted).toMatchObject({
      description: 'Latest persisted integration-test draft',
      revision: 2,
      release: expect.objectContaining({ status: 'draft' }),
    });
  });

  it('does not mutate a configuration when revocation wins the authorization lock', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );
    const revocationDataSource = createDataSource();
    await revocationDataSource.initialize();
    const queryRunner = revocationDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updateSettled = false;
    try {
      await queryRunner.manager.findOne(AppInstanceEntity, {
        where: { id: IDS.appInstance },
        lock: { mode: 'pessimistic_write' },
      });
      await queryRunner.manager.update(
        AppInstanceEntity,
        { id: IDS.appInstance },
        { status: 'suspended' }
      );

      const updatePromise = service
        .updateConfiguration(
          created.id,
          { expectedRevision: 1, description: 'Must not persist' },
          ownerContext
        )
        .finally(() => {
          updateSettled = true;
        });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(updateSettled).toBe(false);

      await queryRunner.commitTransaction();
      await expect(updatePromise).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
      if (revocationDataSource.isInitialized) {
        await revocationDataSource.destroy();
      }
    }

    const persisted = await dataSource
      .getRepository(AppConfigurationEntity)
      .findOneBy({ id: created.id });
    expect(persisted).toMatchObject({
      description: configurationDto.description,
      revision: 1,
    });
  });

  it('returns NotFound when a foreign workspace, app, and profile context reads the configuration', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );
    const instanceRepository = dataSource.getRepository(AppInstanceEntity);
    const membershipRepository = dataSource.getRepository(AppMembershipEntity);

    await instanceRepository.save(
      instanceRepository.create({
        id: IDS.foreignAppInstance,
        workspaceId: IDS.foreignWorkspace,
        appScope: foreignContext.appScope,
        ownerUserId: IDS.foreignUser,
        ownerProfileId: IDS.foreignProfile,
        status: 'active',
      })
    );
    await membershipRepository.save(
      membershipRepository.create({
        id: IDS.foreignMembership,
        workspaceId: IDS.foreignWorkspace,
        appInstanceId: IDS.foreignAppInstance,
        appScope: foreignContext.appScope,
        userId: IDS.foreignUser,
        profileId: IDS.foreignProfile,
        role: 'owner',
        status: 'active',
      })
    );

    await expect(
      service.getConfiguration(created.id, foreignContext)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists publish actor, snapshot, and history and survives service reload', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );

    await service.publishConfiguration(
      created.id,
      {
        expectedRevision: 1,
        releaseNotes: 'Persisted publish',
        changeSummary: 'Publish the integration proof',
      },
      ownerContext
    );

    const persisted = await dataSource
      .getRepository(AppConfigurationEntity)
      .findOneBy({ id: created.id });

    expect(persisted?.release).toMatchObject({
      status: 'published',
      publishedVersion: 1,
      publishedSnapshot: expect.objectContaining({
        name: configurationDto.name,
        domain: configurationDto.domain,
      }),
      history: [
        expect.objectContaining({
          version: 1,
          action: 'publish',
          releasedByUserId: IDS.user,
          releasedByProfileId: IDS.profile,
          snapshot: expect.objectContaining({
            name: configurationDto.name,
            domain: configurationDto.domain,
          }),
        }),
      ],
    });

    reloadedDataSource = createDataSource();
    await reloadedDataSource.initialize();
    const reloaded = await createService(reloadedDataSource).getConfiguration(
      created.id,
      ownerContext
    );

    expect(reloaded.release).toMatchObject({
      status: 'published',
      publishedVersion: 1,
      publishedSnapshot: expect.objectContaining({
        domain: configurationDto.domain,
      }),
      history: [
        expect.objectContaining({
          action: 'publish',
          releasedByUserId: IDS.user,
          releasedByProfileId: IDS.profile,
        }),
      ],
    });
  });

  it('persists rollback to a published snapshot across reload and rejects an unknown release target', async () => {
    const created = await service.createConfiguration(
      configurationDto,
      ownerContext
    );
    await service.publishConfiguration(
      created.id,
      { expectedRevision: 1, releaseNotes: 'Stable release' },
      ownerContext
    );
    await service.updateConfiguration(
      created.id,
      {
        expectedRevision: 2,
        name: 'Changed draft',
        domain: 'changed-draft.example.com',
      },
      ownerContext
    );

    const rolledBack = await service.rollbackConfiguration(
      created.id,
      {
        expectedRevision: 3,
        version: 1,
        releaseNotes: 'Restore stable release',
      },
      ownerContext
    );

    expect(rolledBack).toMatchObject({
      name: configurationDto.name,
      domain: configurationDto.domain,
      revision: 4,
      release: expect.objectContaining({
        status: 'published',
        publishedVersion: 2,
        history: [
          expect.objectContaining({ action: 'publish', version: 1 }),
          expect.objectContaining({ action: 'rollback', version: 2 }),
        ],
      }),
    });

    if (reloadedDataSource?.isInitialized) {
      await reloadedDataSource.destroy();
    }
    reloadedDataSource = createDataSource();
    await reloadedDataSource.initialize();
    const reloaded = await createService(reloadedDataSource).getConfiguration(
      created.id,
      ownerContext
    );

    expect(reloaded).toMatchObject({
      name: configurationDto.name,
      domain: configurationDto.domain,
      revision: 4,
      release: expect.objectContaining({
        publishedVersion: 2,
        publishedSnapshot: expect.objectContaining({
          name: configurationDto.name,
          domain: configurationDto.domain,
        }),
      }),
    });
    await expect(
      createService(reloadedDataSource).rollbackConfiguration(
        created.id,
        {
          expectedRevision: 4,
          version: 999,
          releaseNotes: 'Unknown release target',
        },
        ownerContext
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rolls back all bootstrap rows when configuration persistence fails after app and membership creation', async () => {
    const originalExecute = InsertQueryBuilder.prototype.execute;
    const insertedEntityTypes: string[] = [];
    const executeSpy = jest
      .spyOn(InsertQueryBuilder.prototype, 'execute')
      .mockImplementation(function (this: InsertQueryBuilder<any>) {
        const entityType = this.expressionMap.mainAlias?.metadata?.target;
        insertedEntityTypes.push(
          typeof entityType === 'function'
            ? entityType.name
            : String(entityType)
        );
        if (entityType === AppConfigurationEntity) {
          return Promise.reject(new Error('configuration write failed'));
        }
        return originalExecute.call(this);
      });

    try {
      await expect(
        service.createConfiguration(
          { ...configurationDto, name: 'Should fully roll back' },
          ownerContext
        )
      ).rejects.toThrow('configuration write failed');
    } finally {
      executeSpy.mockRestore();
    }

    expect(insertedEntityTypes).toEqual([
      AppInstanceEntity.name,
      AppMembershipEntity.name,
      AppConfigurationEntity.name,
    ]);
    expect(
      await dataSource.getRepository(AppInstanceEntity).findOneBy({
        id: IDS.appInstance,
      })
    ).toBeNull();
    expect(
      await dataSource.getRepository(AppMembershipEntity).findOneBy({
        id: IDS.membership,
      })
    ).toBeNull();
    expect(
      await dataSource.getRepository(AppConfigurationEntity).findOne({
        where: {
          appInstanceId: IDS.appInstance,
          name: 'Should fully roll back',
        },
      })
    ).toBeNull();
  });
});
