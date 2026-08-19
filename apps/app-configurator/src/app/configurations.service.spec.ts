import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';

describe('ConfigurationsService', () => {
  let service: any;
  let repository: Repository<AppConfigurationEntity>;

  const mockConfigEntity: AppConfigurationEntity = {
    id: 'config-1',
    name: 'Test App',
    description: 'Test Description',
    domain: 'test.example.com',
    landingPage: {} as any,
    routes: [] as any,
    features: {} as any,
    theme: {} as any,
    active: true,
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
    ownerUserId: 'user-owner-a',
    ownerProfileId: 'profile-owner-a',
    appScope: 'business-site',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationsService,
        {
          provide: getRepositoryToken(AppConfigurationEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
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
          getConfiguration: 2,
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
        capabilities: { blogging: { enabled: true } },
      };
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.createConfiguration({
        name: 'Manifest App',
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {},
        manifest,
      });

      expect((result as any).manifest).toEqual(manifest);
    });

    it('should create and save a configuration', async () => {
      const createDto = {
        name: 'New App',
        domain: 'new.example.com',
      } as any;

      jest.spyOn(repository, 'save').mockResolvedValue(mockConfigEntity);

      const result = await service.createConfiguration(createDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockConfigEntity);
    });

    it('should initialize release metadata for a new draft configuration', async () => {
      const createDto = {
        name: 'New App',
        domain: 'new.example.com',
      } as any;

      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

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
  });

  describe('getConfiguration', () => {
    it('should return a configuration if found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);

      const result = await service.getConfiguration('config-1');

      expect(result).toEqual(mockConfigEntity);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getConfiguration('none')).rejects.toThrow(
        NotFoundException
      );
    });

    it('scopes an owner read to the trusted profile and app scope', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);
      const scopedService = service as unknown as {
        getConfiguration: (
          id: string,
          context: {
            ownerUserId: string;
            ownerProfileId: string;
            appScope: string;
          }
        ) => Promise<AppConfigurationEntity>;
      };

      await scopedService.getConfiguration('config-1', {
        ownerUserId: 'user-owner-a',
        ownerProfileId: 'profile-owner-a',
        appScope: 'business-site',
      });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'config-1',
          ownerUserId: 'user-owner-a',
          ownerProfileId: 'profile-owner-a',
          appScope: 'business-site',
        },
      });
    });
  });

  describe('getPublishedConfigurationByDomain', () => {
    it('returns the published snapshot rather than the editable entity', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue({
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
        },
      } as any);

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
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

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
    it('rejects an unsupported manifest schema version', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);

      await expect(
        service.updateConfiguration('config-1', {
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

      const result = await service.updateConfiguration('config-1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateConfiguration('none', { name: 'Updated' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('publishConfiguration', () => {
    it('captures the plugin manifest in a published release snapshot', async () => {
      const manifest = {
        schemaVersion: 1 as const,
        surfaceType: 'community' as const,
        capabilities: { forum: { enabled: true } },
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue({
        ...mockConfigEntity,
        manifest,
      } as any);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (value) => value as any);

      const result = await service.publishConfiguration('config-1', {
        releaseNotes: 'Manifest release',
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

      const result = await service.publishConfiguration('config-1', {
        releaseNotes: 'Launch ready',
        changeSummary: 'Updated hero and CTA',
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
  });

  describe('rollbackConfiguration', () => {
    it('restores the plugin manifest from the selected release snapshot', async () => {
      const manifest = {
        schemaVersion: 1 as const,
        surfaceType: 'business-site' as const,
        capabilities: { blogging: { enabled: true } },
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

      const result = await service.rollbackConfiguration('config-1', {
        version: 1,
        releaseNotes: 'Restore manifest',
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

      const result = await service.rollbackConfiguration('config-1', {
        version: 1,
        releaseNotes: 'Rollback to stable',
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
  });

  describe('deleteConfiguration', () => {
    it('should delete configuration', async () => {
      jest
        .spyOn(repository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await service.deleteConfiguration('config-1');

      expect(repository.delete).toHaveBeenCalledWith({
        id: 'config-1',
        ...ownerContext,
      });
    });

    it('should throw NotFoundException if nothing affected', async () => {
      jest
        .spyOn(repository, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(service.deleteConfiguration('none')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
