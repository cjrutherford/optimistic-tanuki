import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationsController } from './configurations.controller';
import { ConfigurationsService } from '../app/configurations.service';
import { Logger } from '@nestjs/common';

describe('ConfigurationsController', () => {
  let controller: ConfigurationsController;
  let service: ConfigurationsService;

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
            getConfigurationByDomain: jest.fn().mockResolvedValue(mockConfig),
            getConfigurationByName: jest.fn().mockResolvedValue(mockConfig),
            getAllConfigurations: jest.fn().mockResolvedValue([mockConfig]),
            updateConfiguration: jest.fn().mockResolvedValue(mockConfig),
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
    const result = await controller.createConfiguration(dto);
    expect(service.createConfiguration).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockConfig);
  });

  it('getConfiguration should call service', async () => {
    const result = await controller.getConfiguration('1');
    expect(service.getConfiguration).toHaveBeenCalledWith('1');
    expect(result).toEqual(mockConfig);
  });

  it('getConfigurationByDomain should call service', async () => {
    const result = await controller.getConfigurationByDomain({ domain: 'test' });
    expect(service.getConfigurationByDomain).toHaveBeenCalledWith('test');
    expect(result).toEqual(mockConfig);
  });

  it('getConfigurationByName should call service', async () => {
    const result = await controller.getConfigurationByName({ name: 'test' });
    expect(service.getConfigurationByName).toHaveBeenCalledWith('test');
    expect(result).toEqual(mockConfig);
  });

  it('getAllConfigurations should call service', async () => {
    const result = await controller.getAllConfigurations({});
    expect(service.getAllConfigurations).toHaveBeenCalledWith({});
    expect(result).toEqual([mockConfig]);
  });

  it('updateConfiguration should call service', async () => {
    const dto = { id: '1', name: 'Updated' } as any;
    const result = await controller.updateConfiguration(dto);
    expect(service.updateConfiguration).toHaveBeenCalledWith('1', dto);
    expect(result).toEqual(mockConfig);
  });

  it('deleteConfiguration should call service', async () => {
    await controller.deleteConfiguration('1');
    expect(service.deleteConfiguration).toHaveBeenCalledWith('1');
  });
});
