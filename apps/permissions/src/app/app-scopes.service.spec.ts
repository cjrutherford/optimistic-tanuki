import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { AppScopesService } from './app-scopes.service';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { CreateAppScopeDto, UpdateAppScopeDto } from '@optimistic-tanuki/models';

const mockAppScopeRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('AppScopesService', () => {
  let service: AppScopesService;
  let repository: Repository<AppScope>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppScopesService,
        {
          provide: getRepositoryToken(AppScope),
          useFactory: mockAppScopeRepository,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
          },
        }
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
    it('should create and save a new app scope', async () => {
      const createAppScopeDto: CreateAppScopeDto = { name: 'test', description: 'Test Scope' };
      const appScope = new AppScope();

      jest.spyOn(repository, 'create').mockReturnValue(appScope);
      jest.spyOn(repository, 'save').mockResolvedValue(appScope);

      const result = await service.createAppScope(createAppScopeDto);

      expect(repository.create).toHaveBeenCalledWith(createAppScopeDto);
      expect(repository.save).toHaveBeenCalledWith(appScope);
      expect(result).toEqual(appScope);
    });
  });

  describe('getAppScope', () => {
    it('should return an app scope if it exists', async () => {
      const appScope = new AppScope();
      appScope.id = '1';
      jest.spyOn(repository, 'findOne').mockResolvedValue(appScope);

      const result = await service.getAppScope('1');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(appScope);
    });
  });
  
  describe('getAppScopeByName', () => {
    it('should return an app scope if it exists', async () => {
      const appScope = new AppScope();
      appScope.name = 'test';
      jest.spyOn(repository, 'findOne').mockResolvedValue(appScope);

      const result = await service.getAppScopeByName('test');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { name: 'test' } });
      expect(result).toEqual(appScope);
    });
  });

  describe('getAllAppScopes', () => {
    it('should return an array of app scopes', async () => {
      const appScopes = [new AppScope()];
      jest.spyOn(repository, 'find').mockResolvedValue(appScopes);

      const result = await service.getAllAppScopes({});

      expect(repository.find).toHaveBeenCalledWith({});
      expect(result).toEqual(appScopes);
    });
  });

  describe('updateAppScope', () => {
    it('should update an app scope and return it', async () => {
      const updateAppScopeDto: UpdateAppScopeDto = { id: '1', name: 'updated' };
      const appScope = new AppScope();
      appScope.id = '1';

      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(service, 'getAppScope').mockResolvedValue(appScope);

      const result = await service.updateAppScope('1', updateAppScopeDto);

      expect(repository.update).toHaveBeenCalledWith('1', updateAppScopeDto);
      expect(service.getAppScope).toHaveBeenCalledWith('1');
      expect(result).toEqual(appScope);
    });
  });

  describe('deleteAppScope', () => {
    it('should delete an app scope', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await service.deleteAppScope('1');

      expect(repository.delete).toHaveBeenCalledWith('1');
    });
  });
});
