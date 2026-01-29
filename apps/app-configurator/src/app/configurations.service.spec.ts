import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigurationsService } from './configurations.service';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { Logger, NotFoundException } from '@nestjs/common';

describe('ConfigurationsService', () => {
  let service: ConfigurationsService;
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
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AppConfigurationEntity;

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

    service = module.get<ConfigurationsService>(ConfigurationsService);
    repository = module.get<Repository<AppConfigurationEntity>>(
      getRepositoryToken(AppConfigurationEntity)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConfiguration', () => {
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
  });

  describe('getConfigurationByDomain', () => {
    it('should return a configuration if found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockConfigEntity);

      const result = await service.getConfigurationByDomain('test.example.com');
      
      expect(result).toEqual(mockConfigEntity);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getConfigurationByDomain('none')).rejects.toThrow(
        NotFoundException
      );
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

  describe('deleteConfiguration', () => {
    it('should delete configuration', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue({ affected: 1 } as any);

      await service.deleteConfiguration('config-1');
      
      expect(repository.delete).toHaveBeenCalledWith('config-1');
    });

    it('should throw NotFoundException if nothing affected', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue({ affected: 0 } as any);

      await expect(service.deleteConfiguration('none')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
