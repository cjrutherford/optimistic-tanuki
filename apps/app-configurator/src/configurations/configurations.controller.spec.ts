import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationsController } from './configurations.controller';
import { ConfigurationsService } from '../app/configurations.service';
import { Logger } from '@nestjs/common';

describe('ConfigurationsController', () => {
  let controller: ConfigurationsController;
  let service: ConfigurationsService;

  const ownerContext = {
    ownerUserId: 'user-owner-a',
    ownerProfileId: 'profile-owner-a',
    appScope: 'business-site',
  };
  const mockConfig = {
    id: 'config-1',
    name: 'Test App',
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigurationsController],
      providers: [
        {
          provide: ConfigurationsService,
          useValue: {
            createConfiguration: jest.fn().mockResolvedValue(mockConfig),
            getConfiguration: jest.fn().mockResolvedValue(mockConfig),
            getPublishedConfigurationByDomain: jest
              .fn()
              .mockResolvedValue(mockConfig),
            getConfigurationByName: jest.fn().mockResolvedValue(mockConfig),
            getAllConfigurations: jest.fn().mockResolvedValue([mockConfig]),
            updateConfiguration: jest.fn().mockResolvedValue(mockConfig),
            publishConfiguration: jest.fn().mockResolvedValue(mockConfig),
            rollbackConfiguration: jest.fn().mockResolvedValue(mockConfig),
            deleteConfiguration: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ConfigurationsController>(ConfigurationsController);
    service = module.get<ConfigurationsService>(ConfigurationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createConfiguration should call service', async () => {
    const dto = { name: 'New' } as any;
    const result = await controller.createConfiguration({
      dto,
      context: ownerContext,
    });
    expect(service.createConfiguration).toHaveBeenCalledWith(dto, ownerContext);
    expect(result).toEqual(mockConfig);
  });

  it('getConfiguration should call service', async () => {
    const result = await controller.getConfiguration({
      id: '1',
      context: ownerContext,
    });
    expect(service.getConfiguration).toHaveBeenCalledWith('1', ownerContext);
    expect(result).toEqual(mockConfig);
  });

  it('getPublishedConfigurationByDomain should call service', async () => {
    const result = await controller.getPublishedConfigurationByDomain({
      domain: 'test',
    });
    expect(service.getPublishedConfigurationByDomain).toHaveBeenCalledWith(
      'test'
    );
    expect(result).toEqual(mockConfig);
  });

  it('getConfigurationByName should call service', async () => {
    const result = await controller.getConfigurationByName({
      name: 'test',
      context: ownerContext,
    });
    expect(service.getConfigurationByName).toHaveBeenCalledWith(
      'test',
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('getAllConfigurations should call service', async () => {
    const result = await controller.getAllConfigurations({
      context: ownerContext,
    });
    expect(service.getAllConfigurations).toHaveBeenCalledWith(ownerContext, {});
    expect(result).toEqual([mockConfig]);
  });

  it('updateConfiguration should call service', async () => {
    const dto = { name: 'Updated' } as any;
    const result = await controller.updateConfiguration({
      id: '1',
      dto,
      context: ownerContext,
    });
    expect(service.updateConfiguration).toHaveBeenCalledWith(
      '1',
      dto,
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('deleteConfiguration should call service', async () => {
    await controller.deleteConfiguration({ id: '1', context: ownerContext });
    expect(service.deleteConfiguration).toHaveBeenCalledWith('1', ownerContext);
  });

  it('publishConfiguration should call service', async () => {
    const dto = { releaseNotes: 'Launch ready' } as any;
    const result = await controller.publishConfiguration({
      id: '1',
      dto,
      context: ownerContext,
    });
    expect(service.publishConfiguration).toHaveBeenCalledWith(
      '1',
      dto,
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('rollbackConfiguration should call service', async () => {
    const dto = { version: 1, releaseNotes: 'Rollback' } as any;
    const result = await controller.rollbackConfiguration({
      id: '1',
      dto,
      context: ownerContext,
    });
    expect(service.rollbackConfiguration).toHaveBeenCalledWith(
      '1',
      dto,
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });
});
