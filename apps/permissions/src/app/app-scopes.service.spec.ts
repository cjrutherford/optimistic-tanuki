import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { AppScopesService } from './app-scopes.service';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { CreateAppScopeDto, UpdateAppScopeDto } from '@optimistic-tanuki/models';

describe('AppScopesService', () => {
  let service: AppScopesService;
  let repository: Repository<AppScope>;

  const mockAppScope = {
    id: 'scope1',
    name: 'test-scope',
    description: 'Test scope',
    active: true,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppScopesService,
        Logger,
        {
          provide: getRepositoryToken(AppScope),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppScopesService>(AppScopesService);
    repository = module.get<Repository<AppScope>>(
      getRepositoryToken(AppScope)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAppScope', () => {
    it('should create a new app scope', async () => {
      const createAppScopeDto: CreateAppScopeDto = {
        name: 'test-scope',
        description: 'Test scope',
        active: true,
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockAppScope as any);
      jest.spyOn(repository, 'save').mockResolvedValue(mockAppScope as any);

      const result = await service.createAppScope(createAppScopeDto);

      expect(result).toEqual(mockAppScope);
      expect(repository.create).toHaveBeenCalledWith(createAppScopeDto);
      expect(repository.save).toHaveBeenCalledWith(mockAppScope);
    });
  });

  describe('getAppScope', () => {
    it('should return an app scope by id', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAppScope as any);

      const result = await service.getAppScope('scope1');

      expect(result).toEqual(mockAppScope);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'scope1' },
      });
    });

    it('should return undefined if app scope not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(undefined);

      const result = await service.getAppScope('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAppScopeByName', () => {
    it('should return an app scope by name', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAppScope as any);

      const result = await service.getAppScopeByName('test-scope');

      expect(result).toEqual(mockAppScope);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: 'test-scope' },
      });
    });

    it('should return undefined if app scope not found by name', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(undefined);

      const result = await service.getAppScopeByName('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should log search and result', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAppScope as any);

      await service.getAppScopeByName('test-scope');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Searching for AppScope with name: test-scope'
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('AppScope found:')
      );
    });
  });

  describe('getAllAppScopes', () => {
    it('should return all app scopes', async () => {
      const appScopes = [mockAppScope];
      jest.spyOn(repository, 'find').mockResolvedValue(appScopes as any);

      const result = await service.getAllAppScopes({});

      expect(result).toEqual(appScopes);
      expect(repository.find).toHaveBeenCalledWith({});
    });

    it('should return app scopes with query filters', async () => {
      const appScopes = [mockAppScope];
      const query = { where: { active: true } };
      jest.spyOn(repository, 'find').mockResolvedValue(appScopes as any);

      const result = await service.getAllAppScopes(query);

      expect(result).toEqual(appScopes);
      expect(repository.find).toHaveBeenCalledWith(query);
    });

    it('should return empty array if no app scopes exist', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      const result = await service.getAllAppScopes({});

      expect(result).toEqual([]);
    });
  });

  describe('updateAppScope', () => {
    it('should update an app scope', async () => {
      const updateAppScopeDto: UpdateAppScopeDto = {
        id: 'scope1',
        description: 'Updated description',
      };

      const updatedAppScope = {
        ...mockAppScope,
        description: 'Updated description',
      };

      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(repository, 'findOne').mockResolvedValue(updatedAppScope as any);

      const result = await service.updateAppScope('scope1', updateAppScopeDto);

      expect(result).toEqual(updatedAppScope);
      expect(repository.update).toHaveBeenCalledWith('scope1', updateAppScopeDto);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'scope1' },
      });
    });
  });

  describe('deleteAppScope', () => {
    it('should delete an app scope', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await service.deleteAppScope('scope1');

      expect(repository.delete).toHaveBeenCalledWith('scope1');
    });
  });
});
