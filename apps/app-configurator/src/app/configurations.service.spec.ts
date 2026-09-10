import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

describe('ConfigurationsService', () => {
  let service: any;
  let repository: any;
  let appInstanceRepository: any;
  let membershipRepository: any;
  let transactionManager: EntityManager;
  let transaction: jest.Mock;
  let insertQueryBuilder: any;
  const configurationId = '66666666-6666-4666-8666-666666666666';
  const missingConfigurationId = '77777777-7777-4777-8777-777777777777';

  const mockConfigEntity: AppConfigurationEntity = {
    id: configurationId,
    name: 'Test App',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    appInstanceId: '22222222-2222-4222-8222-222222222222',
    ownerUserId: '44444444-4444-4444-8444-444444444444',
    ownerProfileId: '55555555-5555-4555-8555-555555555555',
    appScope: 'business-site',
    description: 'Test Description',
    domain: 'test.example.com',
    landingPage: { sections: [], layout: 'single-column' } as any,
    routes: [] as any,
    features: {} as any,
    theme: {} as any,
    active: true,
    revision: 1,
    release: {
      status: 'draft',
      history: [],
      publishedVersion: null,
      publishedSnapshot: null,
      previewUrl: 'https://test.example.com',
    } as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AppConfigurationEntity;
  const ownerContext = {
    ownerUserId: '44444444-4444-4444-8444-444444444444',
    ownerProfileId: '55555555-5555-4555-8555-555555555555',
    appScope: 'business-site',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    appInstanceId: '22222222-2222-4222-8222-222222222222',
    membershipId: '33333333-3333-4333-8333-333333333333',
    membershipRole: 'owner' as const,
    membershipStatus: 'active' as const,
  };
  const activeAppInstance = {
    id: ownerContext.appInstanceId,
    workspaceId: ownerContext.workspaceId,
    appScope: ownerContext.appScope,
    ownerUserId: ownerContext.ownerUserId,
    ownerProfileId: ownerContext.ownerProfileId,
    status: 'active',
  } as AppInstanceEntity;
  const activeMembership = {
    id: ownerContext.membershipId,
    workspaceId: ownerContext.workspaceId,
    appInstanceId: ownerContext.appInstanceId,
    appScope: ownerContext.appScope,
    userId: ownerContext.ownerUserId,
    profileId: ownerContext.ownerProfileId,
    role: 'owner',
    status: 'active',
  } as AppMembershipEntity;

  beforeEach(async () => {
    let insertedEntity: any;
    insertQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((value) => {
        insertedEntity = value;
        return insertQueryBuilder;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const configRepositoryValue = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => insertQueryBuilder),
      save: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(({ where } = {}) =>
        where?.name && insertedEntity?.name === where.name
          ? Promise.resolve(insertedEntity)
          : Promise.resolve(undefined)
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn(),
    };
    const appInstanceRepositoryValue = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => insertQueryBuilder),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(activeAppInstance),
    };
    const membershipRepositoryValue = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => insertQueryBuilder),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(activeMembership),
    };
    transactionManager = {
      getRepository: jest.fn((entity) => {
        if (entity === AppConfigurationEntity) return configRepositoryValue;
        if (entity === AppInstanceEntity) return appInstanceRepositoryValue;
        if (entity === AppMembershipEntity) return membershipRepositoryValue;
        throw new Error('Unexpected repository');
      }),
    } as unknown as EntityManager;
    transaction = jest.fn(async (callback) => callback(transactionManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationsService,
        {
          provide: getRepositoryToken(AppConfigurationEntity),
          useValue: { ...configRepositoryValue, manager: { transaction } },
        },
        {
          provide: getRepositoryToken(AppInstanceEntity),
          useValue: appInstanceRepositoryValue,
        },
        {
          provide: getRepositoryToken(AppMembershipEntity),
          useValue: membershipRepositoryValue,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    const configuredService = module.get<ConfigurationsService>(
      ConfigurationsService
    );
    service = new Proxy(configuredService, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        const requiredArgs: Record<string, number> = {
          createConfiguration: 2,
          reconcileSeedConfiguration: 2,
          getConfiguration: 2,
          getConfigurationByName: 2,
          getConfigurationByContext: 1,
          getAllConfigurations: 2,
          updateConfiguration: 3,
          publishConfiguration: 3,
          rollbackConfiguration: 3,
          deleteConfiguration: 2,
        };
        if (typeof value !== 'function' || !requiredArgs[property as string]) {
          return value;
        }
        return (...args: unknown[]) =>
          value.apply(
            target,
            args.length < requiredArgs[property as string]
              ? [...args, ownerContext]
              : args
          );
      },
    });
    repository = module.get<Repository<AppConfigurationEntity>>(
      getRepositoryToken(AppConfigurationEntity)
    );
    appInstanceRepository = module.get<Repository<AppInstanceEntity>>(
      getRepositoryToken(AppInstanceEntity)
    );
    membershipRepository = module.get<Repository<AppMembershipEntity>>(
      getRepositoryToken(AppMembershipEntity)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConfiguration', () => {
    it('rejects an unsupported manifest schema version', async () => {
      await expect(
        service.createConfiguration({
          name: 'Unsupported Manifest',
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {},
          manifest: {
            schemaVersion: 2,
            surfaceType: 'business-site',
            capabilities: {},
          },
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('persists a supplied plugin manifest', async () => {
      const manifest = {
        schemaVersion: 1 as const,
        surfaceType: 'business-site' as const,
        capabilities: { 'blogging.posts': { enabled: true } },
      };
      const result = await service.createConfiguration({
        name: 'Manifest App',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
        manifest,
      });

      expect((result as any).manifest).toEqual(manifest);
      expect(insertQueryBuilder.execute).toHaveBeenCalled();
    });

    it('rejects a manifest capability that is absent from the catalog', async () => {
      await expect(
        service.createConfiguration({
          name: 'Unknown capability',
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {},
          manifest: {
            schemaVersion: 1,
            surfaceType: 'business-site',
            capabilities: { 'store.inventory-admin': { enabled: true } },
          },
        } as any)
      ).rejects.toThrow(
        'Unknown configurable capability: store.inventory-admin'
      );
    });

    it('should create and save a configuration', async () => {
      const createDto = {
        name: 'New App',
        domain: 'new.example.com',
      } as any;

      const result = await service.createConfiguration(createDto);

      expect(insertQueryBuilder.execute).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining(createDto));
    });

    it('should initialize release metadata for a new draft configuration', async () => {
      const createDto = {
        name: 'New App',
        domain: 'new.example.com',
      } as any;

      const result = await service.createConfiguration(createDto);

      expect(result.release).toEqual(
        expect.objectContaining({
          status: 'draft',
          publishedVersion: null,
          history: [],
          previewUrl: 'https://new.example.com',
        })
      );
    });

    it('starts a new configuration at revision one', async () => {
      const result = await service.createConfiguration({
        name: 'Revisioned App',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
      });

      expect(result.revision).toBe(1);
    });

    it('transactionally bootstraps the workspace app, owner membership, and draft', async () => {
      appInstanceRepository.findOne.mockResolvedValueOnce(null);
      membershipRepository.findOne.mockResolvedValueOnce(null);
      appInstanceRepository.save.mockImplementation(async (value) => ({
        ...value,
        id: ownerContext.appInstanceId,
      }));
      membershipRepository.save.mockImplementation(async (value) => ({
        ...value,
        id: ownerContext.membershipId,
      }));
      repository.save.mockImplementation(async (value) => ({
        ...value,
        id: 'config-bootstrapped',
      }));

      const result = await service.createConfiguration({
        name: 'Bootstrapped App',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(appInstanceRepository.createQueryBuilder).toHaveBeenCalled();
      expect(membershipRepository.createQueryBuilder).toHaveBeenCalled();
      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(result.id).toBeUndefined();
      /*
       * The insert query is conflict-safe; the authoritative row is returned
       * by the final natural-key re-read.
       */
      expect(result).toEqual(
        expect.objectContaining({
          name: 'Bootstrapped App',
          revision: 1,
        })
      );
    });

    it('is idempotent when the workspace app, owner membership, and draft already exist', async () => {
      appInstanceRepository.findOne.mockResolvedValueOnce(activeAppInstance);
      membershipRepository.findOne.mockResolvedValueOnce(activeMembership);
      repository.findOne.mockResolvedValueOnce(mockConfigEntity);

      const result = await service.createConfiguration({
        name: 'Test App',
        description: 'Test Description',
        domain: 'test.example.com',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
        active: true,
      });

      expect(result).toBe(mockConfigEntity);
      expect(appInstanceRepository.save).not.toHaveBeenCalled();
      expect(membershipRepository.save).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rolls back the bootstrap transaction when a row cannot be persisted', async () => {
      let rolledBack = false;
      transaction.mockImplementationOnce(async (callback) => {
        try {
          return await callback(transactionManager);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      });
      appInstanceRepository.findOne.mockResolvedValueOnce(null);
      membershipRepository.findOne.mockResolvedValueOnce(null);
      insertQueryBuilder.execute
        .mockResolvedValueOnce({ affected: 1 })
        .mockRejectedValueOnce(new Error('membership write failed'));

      await expect(
        service.createConfiguration({
          name: 'Should Roll Back',
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {},
        })
      ).rejects.toThrow('membership write failed');

      expect(rolledBack).toBe(true);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects an inactive or non-owner bootstrap context', async () => {
      await expect(
        service.createConfiguration(
          {
            name: 'Rejected Bootstrap',
            landingPage: { sections: [], layout: 'single-column' },
            routes: [],
            features: {},
            theme: {},
          },
          {
            ...ownerContext,
            membershipRole: 'member',
            membershipStatus: 'suspended',
          }
        )
      ).rejects.toThrow(ForbiddenException);

      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('reconcileSeedConfiguration', () => {
    const seedDto = {
      name: 'Test App',
      description: 'Test Description',
      domain: 'test.example.com',
      landingPage: { sections: [{ id: 'hero' }], layout: 'single-column' },
      routes: [{ path: '/', component: 'home' }],
      features: { social: { enabled: true } },
      theme: { primaryColor: '#007bff' },
      active: true,
    } as any;

    it('reuses an equivalent existing row without inserting or updating', async () => {
      const existing = {
        ...mockConfigEntity,
        name: seedDto.name,
        description: seedDto.description,
        domain: seedDto.domain,
        landingPage: seedDto.landingPage,
        routes: seedDto.routes,
        features: seedDto.features,
        theme: seedDto.theme,
        active: seedDto.active,
      } as AppConfigurationEntity;
      repository.findOne.mockResolvedValueOnce(existing);

      const result = await service.reconcileSeedConfiguration(seedDto);

      expect(result).toBe(existing);
      expect(insertQueryBuilder.execute).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('adopts a legacy app-instance ID and scopes seed membership and configuration to it', async () => {
      const legacyAppInstanceId = '99999999-9999-4999-8999-999999999999';
      const legacyAppInstance = {
        ...activeAppInstance,
        id: legacyAppInstanceId,
      } as AppInstanceEntity;
      const legacyMembership = {
        ...activeMembership,
        appInstanceId: legacyAppInstanceId,
      } as AppMembershipEntity;
      const existing = {
        ...mockConfigEntity,
        name: seedDto.name,
        appInstanceId: legacyAppInstanceId,
        description: seedDto.description,
        domain: seedDto.domain,
        landingPage: seedDto.landingPage,
        routes: seedDto.routes,
        features: seedDto.features,
        theme: seedDto.theme,
        active: seedDto.active,
      } as AppConfigurationEntity;

      appInstanceRepository.findOne
        .mockResolvedValueOnce(legacyAppInstance)
        .mockResolvedValueOnce(null);
      membershipRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(legacyMembership);
      repository.findOne.mockResolvedValueOnce(existing);

      const result = await service.reconcileSeedConfiguration(seedDto);

      expect(result).toBe(existing);
      expect(membershipRepository.findOne).toHaveBeenCalledWith({
        where: {
          appInstanceId: legacyAppInstanceId,
          profileId: ownerContext.ownerProfileId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      expect(insertQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          appInstanceId: legacyAppInstanceId,
          workspaceId: ownerContext.workspaceId,
          profileId: ownerContext.ownerProfileId,
        })
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          workspaceId: ownerContext.workspaceId,
          appInstanceId: legacyAppInstanceId,
          name: seedDto.name,
        },
        lock: { mode: 'pessimistic_write' },
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('adopts a legacy owner membership ID when its complete context matches', async () => {
      const legacyAppInstanceId = '99999999-9999-4999-8999-999999999999';
      const legacyMembershipId = '88888888-8888-4888-8888-888888888888';
      const legacyAppInstance = {
        ...activeAppInstance,
        id: legacyAppInstanceId,
      } as AppInstanceEntity;
      const legacyMembership = {
        ...activeMembership,
        id: legacyMembershipId,
        appInstanceId: legacyAppInstanceId,
      } as AppMembershipEntity;
      const existing = {
        ...mockConfigEntity,
        name: seedDto.name,
        appInstanceId: legacyAppInstanceId,
        description: seedDto.description,
        domain: seedDto.domain,
        landingPage: seedDto.landingPage,
        routes: seedDto.routes,
        features: seedDto.features,
        theme: seedDto.theme,
        active: seedDto.active,
      } as AppConfigurationEntity;

      appInstanceRepository.findOne
        .mockResolvedValueOnce(legacyAppInstance)
        .mockResolvedValueOnce(null);
      membershipRepository.findOne
        .mockResolvedValueOnce(legacyMembership)
        .mockResolvedValueOnce(null);
      repository.findOne.mockResolvedValueOnce(existing);

      const result = await service.reconcileSeedConfiguration(seedDto);

      expect(result).toBe(existing);
      expect(membershipRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { id: ownerContext.membershipId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(insertQueryBuilder.execute).not.toHaveBeenCalled();
    });

    it('rejects a legacy owner membership with any mismatched context field', async () => {
      const legacyAppInstanceId = '99999999-9999-4999-8999-999999999999';
      const legacyAppInstance = {
        ...activeAppInstance,
        id: legacyAppInstanceId,
      } as AppInstanceEntity;
      const mismatchedMembership = {
        ...activeMembership,
        id: '88888888-8888-4888-8888-888888888888',
        appInstanceId: legacyAppInstanceId,
        appScope: 'another-app-scope',
      } as AppMembershipEntity;

      appInstanceRepository.findOne
        .mockResolvedValueOnce(legacyAppInstance)
        .mockResolvedValueOnce(null);
      membershipRepository.findOne
        .mockResolvedValueOnce(mismatchedMembership)
        .mockResolvedValueOnce(null);

      await expect(service.reconcileSeedConfiguration(seedDto)).rejects.toThrow(
        ForbiddenException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects the requested membership ID when it collides with another membership', async () => {
      const legacyAppInstanceId = '99999999-9999-4999-8999-999999999999';
      const legacyMembership = {
        ...activeMembership,
        id: '88888888-8888-4888-8888-888888888888',
        appInstanceId: legacyAppInstanceId,
      } as AppMembershipEntity;
      const collidingMembership = {
        ...activeMembership,
        id: ownerContext.membershipId,
        appInstanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      } as AppMembershipEntity;

      appInstanceRepository.findOne
        .mockResolvedValueOnce({
          ...activeAppInstance,
          id: legacyAppInstanceId,
        })
        .mockResolvedValueOnce(null);
      membershipRepository.findOne
        .mockResolvedValueOnce(legacyMembership)
        .mockResolvedValueOnce(collidingMembership);

      await expect(service.reconcileSeedConfiguration(seedDto)).rejects.toThrow(
        ConflictException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('rejects a requested membership ID collision when the natural-key membership is absent', async () => {
      const collidingMembership = {
        ...activeMembership,
        id: ownerContext.membershipId,
        appInstanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      } as AppMembershipEntity;

      appInstanceRepository.findOne.mockResolvedValue(activeAppInstance);
      membershipRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(collidingMembership);

      await expect(service.reconcileSeedConfiguration(seedDto)).rejects.toThrow(
        'Requested owner membership ID is already used by another membership'
      );
    });

    it('rejects a requested app-instance ID already owned by another workspace', async () => {
      const legacyAppInstance = {
        ...activeAppInstance,
        id: '99999999-9999-4999-8999-999999999999',
      } as AppInstanceEntity;
      const conflictingAppInstance = {
        ...activeAppInstance,
        workspaceId: '88888888-8888-4888-8888-888888888888',
      } as AppInstanceEntity;

      appInstanceRepository.findOne
        .mockResolvedValueOnce(legacyAppInstance)
        .mockResolvedValueOnce(conflictingAppInstance);
      membershipRepository.findOne.mockResolvedValueOnce({
        ...activeMembership,
        appInstanceId: legacyAppInstance.id,
      });

      await expect(service.reconcileSeedConfiguration(seedDto)).rejects.toThrow(
        ForbiddenException
      );
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('updates differing mutable seed fields with the existing revision', async () => {
      const existing = {
        ...mockConfigEntity,
        name: seedDto.name,
        description: 'Old description',
        domain: 'old.example.com',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: { social: { enabled: false } },
        theme: { primaryColor: '#000000' },
        active: false,
        revision: 7,
      } as AppConfigurationEntity;
      repository.findOne.mockResolvedValueOnce(existing);
      repository.update.mockResolvedValueOnce({ affected: 1 } as any);

      const result = await service.reconcileSeedConfiguration(seedDto);

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existing.id,
          workspaceId: ownerContext.workspaceId,
          appInstanceId: ownerContext.appInstanceId,
          ownerUserId: ownerContext.ownerUserId,
          ownerProfileId: ownerContext.ownerProfileId,
          appScope: ownerContext.appScope,
          revision: 7,
        }),
        expect.objectContaining({
          description: seedDto.description,
          domain: seedDto.domain,
          landingPage: seedDto.landingPage,
          routes: seedDto.routes,
          features: seedDto.features,
          theme: seedDto.theme,
          active: seedDto.active,
          revision: 8,
        })
      );
      expect(result.revision).toBe(8);
      expect(result.workspaceId).toBe(ownerContext.workspaceId);
      expect(result.appInstanceId).toBe(ownerContext.appInstanceId);
      expect(result.ownerUserId).toBe(ownerContext.ownerUserId);
      expect(result.ownerProfileId).toBe(ownerContext.ownerProfileId);
      expect(result.appScope).toBe(ownerContext.appScope);
      expect(insertQueryBuilder.execute).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getConfiguration', () => {
    it('rejects malformed persisted context IDs before any database work', async () => {
      await expect(
        service.getConfiguration(configurationId, {
          ...ownerContext,
          appInstanceId: 'not-a-uuid',
        })
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(appInstanceRepository.findOne).not.toHaveBeenCalled();
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('should return a configuration if found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);

      const result = await service.getConfiguration(configurationId);

      expect(result).toEqual(mockConfigEntity);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.getConfiguration(missingConfigurationId)
      ).rejects.toThrow(NotFoundException);
    });

    it('scopes an owner read to the trusted profile and app scope', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);
      const scopedService = service as unknown as {
        getConfiguration: (
          id: string,
          context: typeof ownerContext
        ) => Promise<AppConfigurationEntity>;
      };

      await scopedService.getConfiguration(configurationId, ownerContext);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: configurationId,
          workspaceId: ownerContext.workspaceId,
          appInstanceId: ownerContext.appInstanceId,
          ownerUserId: ownerContext.ownerUserId,
          ownerProfileId: ownerContext.ownerProfileId,
          appScope: 'business-site',
        },
      });
    });

    it('denies a read when the app instance is inactive', async () => {
      appInstanceRepository.findOne.mockResolvedValueOnce({
        ...activeAppInstance,
        status: 'suspended',
      });

      await expect(service.getConfiguration(configurationId)).rejects.toThrow(
        ForbiddenException
      );
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('denies a read when the context app instance does not match the workspace app', async () => {
      await expect(
        service.getConfiguration(configurationId, {
          ...ownerContext,
          appInstanceId: '66666666-6666-4666-8666-666666666666',
        })
      ).rejects.toThrow(ForbiddenException);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('denies a read when the owner membership is inactive', async () => {
      membershipRepository.findOne.mockResolvedValueOnce({
        ...activeMembership,
        status: 'revoked',
      });

      await expect(service.getConfiguration(configurationId)).rejects.toThrow(
        ForbiddenException
      );
      expect(repository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('legacy release normalization at the read boundary', () => {
    const legacyReleases = [
      ['null release', null],
      ['empty release object', {}],
      ['incomplete release object', { status: 'published' }],
    ] as const;

    it.each(legacyReleases)(
      'normalizes a %s for getByContext and keeps the revision consistent',
      async (_label, release) => {
        const legacy = {
          ...mockConfigEntity,
          revision: undefined,
          release,
        } as any;
        repository.findOne.mockResolvedValueOnce(legacy);

        const result = await service.getConfigurationByContext();

        expect(result).toBe(legacy);
        expect(result.revision).toBe(1);
        expect(result.release).toEqual({
          status: 'draft',
          publishedVersion: null,
          publishedSnapshot: null,
          previewUrl: 'https://test.example.com',
          history: [],
        });
      }
    );

    it.each(legacyReleases)(
      'normalizes a %s for an identified configuration read',
      async (_label, release) => {
        const legacy = {
          ...mockConfigEntity,
          revision: 0,
          release,
        } as any;
        repository.findOne.mockResolvedValueOnce(legacy);

        const result = await service.getConfiguration(configurationId);

        expect(result.revision).toBe(1);
        expect(result.release).toEqual(
          expect.objectContaining({
            status: 'draft',
            publishedVersion: null,
            publishedSnapshot: null,
            history: [],
          })
        );
      }
    );

    it('normalizes every configuration returned by list and name reads', async () => {
      const legacyByName = {
        ...mockConfigEntity,
        revision: undefined,
        release: {},
      } as any;
      const legacyFromList = {
        ...mockConfigEntity,
        id: missingConfigurationId,
        revision: undefined,
        release: null,
      } as any;
      repository.findOne.mockResolvedValueOnce(legacyByName);
      await expect(service.getConfigurationByName('Test App')).resolves.toBe(
        legacyByName
      );
      repository.find.mockResolvedValueOnce([legacyFromList]);

      const result = await service.getAllConfigurations();

      expect(result[0].revision).toBe(1);
      expect(result[0].release).toEqual(
        expect.objectContaining({ status: 'draft', history: [] })
      );
    });

    it('preserves a server-confirmed published release during reads', async () => {
      const publishedRelease = {
        status: 'published',
        publishedVersion: 3,
        publishedSnapshot: {
          name: 'Published App',
          description: '',
          domain: 'test.example.com',
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {},
          active: true,
        },
        previewUrl: 'https://test.example.com',
        history: [
          {
            version: 3,
            action: 'publish',
            releaseNotes: 'Confirmed',
            snapshot: {
              name: 'Published App',
              description: '',
              domain: 'test.example.com',
              landingPage: { sections: [], layout: 'single-column' },
              routes: [],
              features: {},
              theme: {},
              active: true,
            },
          },
        ],
      };
      const published = {
        ...mockConfigEntity,
        revision: 8,
        release: publishedRelease,
      } as any;
      repository.findOne.mockResolvedValueOnce(published);

      const result = await service.getConfigurationByContext();

      expect(result.revision).toBe(8);
      expect(result.release).toBe(publishedRelease);
    });
  });

  describe('configuration ID validation', () => {
    it('rejects a malformed ID before repository access on find', async () => {
      await expect(service.getConfiguration('not-a-uuid')).rejects.toThrow(
        BadRequestException
      );

      expect(transaction).not.toHaveBeenCalled();
      expect(appInstanceRepository.findOne).not.toHaveBeenCalled();
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('rejects a malformed ID before repository access on update', async () => {
      await expect(
        service.updateConfiguration('not-a-uuid', {
          name: 'Updated',
          expectedRevision: 1,
        })
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(appInstanceRepository.findOne).not.toHaveBeenCalled();
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a malformed ID before repository access on publish', async () => {
      await expect(
        service.publishConfiguration('not-a-uuid', { expectedRevision: 1 })
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(appInstanceRepository.findOne).not.toHaveBeenCalled();
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a malformed ID before repository access on rollback', async () => {
      await expect(
        service.rollbackConfiguration('not-a-uuid', {
          version: 1,
          expectedRevision: 1,
        })
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(appInstanceRepository.findOne).not.toHaveBeenCalled();
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a malformed ID before repository access on delete', async () => {
      await expect(service.deleteConfiguration('not-a-uuid')).rejects.toThrow(
        BadRequestException
      );

      expect(transaction).not.toHaveBeenCalled();
      expect(appInstanceRepository.findOne).not.toHaveBeenCalled();
      expect(membershipRepository.findOne).not.toHaveBeenCalled();
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPublishedConfigurationByDomain', () => {
    it('returns the published snapshot rather than the editable entity', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([
        {
          ...mockConfigEntity,
          release: {
            ...mockConfigEntity.release,
            status: 'published',
            publishedVersion: 1,
            publishedSnapshot: {
              name: 'Published',
              description: '',
              domain: 'test.example.com',
              landingPage: { sections: [], layout: 'single-column' },
              routes: [],
              features: {},
              theme: {},
              active: true,
            },
            history: [
              {
                version: 1,
                action: 'publish',
                releaseNotes: 'Initial release',
                snapshot: {
                  name: 'Published',
                  description: '',
                  domain: 'test.example.com',
                  landingPage: { sections: [], layout: 'single-column' },
                  routes: [],
                  features: {},
                  theme: {},
                  active: true,
                },
              },
            ],
          },
        } as any,
      ]);

      const result = await service.getPublishedConfigurationByDomain(
        'test.example.com'
      );

      expect(result).toEqual(
        expect.objectContaining({ name: 'Published', publishedVersion: 1 })
      );
      expect(result).not.toHaveProperty('release');
      expect(result).not.toHaveProperty('ownerProfileId');
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      await expect(
        service.getPublishedConfigurationByDomain('none')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConfigurationByName', () => {
    it('should return a configuration if found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);

      const result = await service.getConfigurationByName('Test App');

      expect(result).toEqual(mockConfigEntity);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getConfigurationByName('none')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getAllConfigurations', () => {
    it('should return all configurations', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockConfigEntity]);

      const result = await service.getAllConfigurations();

      expect(result).toEqual([mockConfigEntity]);
    });
  });

  describe('updateConfiguration', () => {
    it('authorizes and applies the revision CAS inside one transaction', async () => {
      repository.findOne.mockResolvedValueOnce(mockConfigEntity);
      repository.update.mockResolvedValueOnce({ affected: 1 } as any);

      await service.updateConfiguration(configurationId, {
        name: 'Transaction-bound update',
        expectedRevision: 1,
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transactionManager.getRepository).toHaveBeenCalledWith(
        AppConfigurationEntity
      );
      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({ revision: 1 }),
        expect.objectContaining({ revision: 2 })
      );
    });

    it('rejects an unsupported manifest schema version', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);

      await expect(
        service.updateConfiguration(configurationId, {
          manifest: {
            schemaVersion: 2,
            surfaceType: 'business-site',
            capabilities: {},
          },
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should update and save configuration', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...mockConfigEntity,
        name: 'Updated Name',
      } as any);

      const result = await service.updateConfiguration(configurationId, {
        name: 'Updated Name',
        expectedRevision: 1,
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateConfiguration(missingConfigurationId, {
          name: 'Updated',
          expectedRevision: 1,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an update when the owner has a stale revision', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);
      jest
        .spyOn(repository, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.updateConfiguration(configurationId, {
          name: 'Stale update',
          expectedRevision: 1,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('persists only the requested payload with a scoped revision CAS', async () => {
      const config = {
        ...mockConfigEntity,
        revision: 4,
        name: 'Before Update',
      } as AppConfigurationEntity;
      repository.findOne.mockResolvedValueOnce(config);
      repository.update.mockResolvedValueOnce({ affected: 1 } as any);

      const result = await service.updateConfiguration(configurationId, {
        name: 'After Update',
        description: 'Updated description',
        expectedRevision: 4,
      });

      expect(repository.update).toHaveBeenCalledWith(
        {
          id: configurationId,
          workspaceId: ownerContext.workspaceId,
          appInstanceId: ownerContext.appInstanceId,
          ownerUserId: ownerContext.ownerUserId,
          ownerProfileId: ownerContext.ownerProfileId,
          appScope: ownerContext.appScope,
          revision: 4,
        },
        expect.objectContaining({
          name: 'After Update',
          description: 'Updated description',
          revision: 5,
        })
      );
      expect(result.revision).toBe(5);
    });

    it('does not apply browser-supplied authoritative context fields to a mutation', async () => {
      const config = {
        ...mockConfigEntity,
        revision: 1,
        name: 'Before Update',
      } as AppConfigurationEntity;
      repository.findOne.mockResolvedValueOnce(config);
      repository.update.mockResolvedValueOnce({ affected: 1 } as any);

      const result = await service.updateConfiguration(configurationId, {
        name: 'After Update',
        expectedRevision: 1,
        workspaceId: '99999999-9999-4999-8999-999999999999',
        appInstanceId: '88888888-8888-4888-8888-888888888888',
        membershipId: '77777777-7777-4777-8777-777777777777',
        ownerUserId: '66666666-6666-4666-8666-666666666666',
        ownerProfileId: '55555555-5555-4555-8555-555555555555',
        appScope: 'forged-scope',
        membershipRole: 'member',
        membershipStatus: 'active',
        role: 'member',
        status: 'suspended',
      } as any);

      expect(result).toEqual(
        expect.objectContaining({
          name: 'After Update',
          workspaceId: ownerContext.workspaceId,
          appInstanceId: ownerContext.appInstanceId,
          ownerUserId: ownerContext.ownerUserId,
          ownerProfileId: ownerContext.ownerProfileId,
          appScope: ownerContext.appScope,
        })
      );
      expect(result).not.toHaveProperty('membershipId');
      expect(result).not.toHaveProperty('membershipRole');
      expect(result).not.toHaveProperty('membershipStatus');
      expect(result).not.toHaveProperty('role');
      expect(result).not.toHaveProperty('status');
    });
  });

  describe('publishConfiguration', () => {
    it('captures the plugin manifest in a published release snapshot', async () => {
      const manifest = {
        schemaVersion: 1 as const,
        surfaceType: 'community' as const,
        capabilities: { 'forum.discussions': { enabled: true } },
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue({
        ...mockConfigEntity,
        manifest,
      } as any);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.publishConfiguration(configurationId, {
        releaseNotes: 'Manifest release',
        expectedRevision: 1,
      });

      expect(result.release.publishedSnapshot?.manifest).toEqual(manifest);
    });

    it('should create a published revision with release notes', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue({
        ...mockConfigEntity,
        release: {
          status: 'draft',
          history: [],
          publishedVersion: null,
          publishedSnapshot: null,
          previewUrl: 'https://test.example.com',
        },
      } as any);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.publishConfiguration(configurationId, {
        releaseNotes: 'Launch ready',
        changeSummary: 'Updated hero and CTA',
        expectedRevision: 1,
      });

      expect(result.release).toEqual(
        expect.objectContaining({
          status: 'published',
          publishedVersion: 1,
          releaseNotes: 'Launch ready',
          changeSummary: 'Updated hero and CTA',
          history: [
            expect.objectContaining({
              version: 1,
              action: 'publish',
              releaseNotes: 'Launch ready',
            }),
          ],
        })
      );
    });

    it('records the trusted owner as the publish actor', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.publishConfiguration(configurationId, {
        releaseNotes: 'Audited release',
        expectedRevision: 1,
      });

      expect(result.release.history[0]).toEqual(
        expect.objectContaining({
          releasedByUserId: ownerContext.ownerUserId,
          releasedByProfileId: ownerContext.ownerProfileId,
          appScope: ownerContext.appScope,
        })
      );
    });

    it('rejects a publish when the owner has a stale revision', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);
      jest
        .spyOn(repository, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.publishConfiguration(configurationId, {
          releaseNotes: 'Stale release',
          expectedRevision: 1,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rollbackConfiguration', () => {
    it('returns not found when the requested rollback revision is absent', async () => {
      repository.findOne.mockResolvedValueOnce({
        ...mockConfigEntity,
        release: {
          ...mockConfigEntity.release,
          history: [],
        },
      } as any);

      await expect(
        service.rollbackConfiguration(configurationId, {
          version: 99,
          expectedRevision: 1,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('restores the plugin manifest from the selected release snapshot', async () => {
      const manifest = {
        schemaVersion: 1 as const,
        surfaceType: 'business-site' as const,
        capabilities: { 'blogging.posts': { enabled: true } },
      };
      const publishedSnapshot = {
        name: 'Published App',
        description: 'Published Description',
        domain: 'published.example.com',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
        manifest,
        active: true,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue({
        ...mockConfigEntity,
        release: {
          status: 'changes-pending',
          publishedVersion: 1,
          publishedSnapshot,
          history: [
            {
              version: 1,
              action: 'publish',
              releaseNotes: 'Initial launch',
              snapshot: publishedSnapshot,
            },
          ],
        },
      } as any);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.rollbackConfiguration(configurationId, {
        version: 1,
        releaseNotes: 'Restore manifest',
        expectedRevision: 1,
      });

      expect((result as any).manifest).toEqual(manifest);
    });

    it('should restore the selected published revision snapshot', async () => {
      const publishedSnapshot = {
        name: 'Published App',
        description: 'Published Description',
        domain: 'published.example.com',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
        active: true,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue({
        ...mockConfigEntity,
        name: 'Draft App',
        release: {
          status: 'changes-pending',
          publishedVersion: 1,
          publishedSnapshot,
          previewUrl: 'https://published.example.com',
          history: [
            {
              version: 1,
              action: 'publish',
              releasedAt: new Date(),
              releaseNotes: 'Initial launch',
              changeSummary: 'Launch',
              snapshot: publishedSnapshot,
            },
          ],
        },
      } as any);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.rollbackConfiguration(configurationId, {
        version: 1,
        releaseNotes: 'Rollback to stable',
        expectedRevision: 1,
      });

      expect(result.name).toBe('Published App');
      expect(result.release.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'rollback',
            releaseNotes: 'Rollback to stable',
            version: 2,
          }),
        ])
      );
      expect(result.release.status).toBe('published');
    });

    it('rejects a rollback when the owner has a stale revision', async () => {
      const publishedSnapshot = {
        name: 'Published App',
        description: 'Published Description',
        domain: 'published.example.com',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
        active: true,
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue({
        ...mockConfigEntity,
        release: {
          ...mockConfigEntity.release,
          status: 'published',
          publishedVersion: 1,
          publishedSnapshot,
          history: [
            {
              version: 1,
              action: 'publish',
              releaseNotes: 'Initial launch',
              snapshot: publishedSnapshot,
            },
          ],
        },
      } as any);
      jest
        .spyOn(repository, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.rollbackConfiguration(configurationId, {
          version: 1,
          releaseNotes: 'Stale rollback',
          expectedRevision: 1,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteConfiguration', () => {
    it('should delete configuration', async () => {
      jest
        .spyOn(repository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await service.deleteConfiguration(configurationId);

      expect(repository.delete).toHaveBeenCalledWith({
        id: configurationId,
        workspaceId: ownerContext.workspaceId,
        appInstanceId: ownerContext.appInstanceId,
        ownerUserId: ownerContext.ownerUserId,
        ownerProfileId: ownerContext.ownerProfileId,
        appScope: ownerContext.appScope,
      });
    });

    it('returns a defined acknowledgement so the TCP RPC can complete', async () => {
      jest
        .spyOn(repository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await expect(
        service.deleteConfiguration(configurationId)
      ).resolves.toEqual({
        deleted: true,
      });
    });

    it('should throw NotFoundException if nothing affected', async () => {
      jest
        .spyOn(repository, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.deleteConfiguration(missingConfigurationId)
      ).rejects.toThrow(NotFoundException);
    });
  });
});
