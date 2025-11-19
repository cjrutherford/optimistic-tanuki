import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AppScopesController } from './app-scopes.controller';
import { AppScopesService } from '../app/app-scopes.service';
import { CreateAppScopeDto, UpdateAppScopeDto } from '@optimistic-tanuki/models';
import { AppScope } from './entities/app-scope.entity';

describe('AppScopesController', () => {
  let controller: AppScopesController;
  let service: AppScopesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppScopesController],
      providers: [
        {
          provide: AppScopesService,
          useValue: {
            createAppScope: jest.fn(),
            getAppScope: jest.fn(),
            getAppScopeByName: jest.fn(),
            getAllAppScopes: jest.fn(),
            updateAppScope: jest.fn(),
            deleteAppScope: jest.fn(),
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

    controller = module.get<AppScopesController>(AppScopesController);
    service = module.get<AppScopesService>(AppScopesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAppScope', () => {
    it('should call service.createAppScope with the correct data', async () => {
      const createAppScopeDto: CreateAppScopeDto = { name: 'test', description: 'Test Scope' };
      await controller.createAppScope(createAppScopeDto);
      expect(service.createAppScope).toHaveBeenCalledWith(createAppScopeDto);
    });
  });

  describe('getAppScope', () => {
    it('should call service.getAppScope with the correct id', async () => {
      const id = '1';
      await controller.getAppScope(id);
      expect(service.getAppScope).toHaveBeenCalledWith(id);
    });
  });

  describe('getAppScopeByName', () => {
    it('should call service.getAppScopeByName with the correct name', async () => {
      const name = 'test';
      await controller.getAppScopeByName(name);
      expect(service.getAppScopeByName).toHaveBeenCalledWith(name);
    });
  });
  
  describe('getAllAppScopes', () => {
    it('should call service.getAllAppScopes with the correct query', async () => {
      const query = { where: { name: 'test' } };
      await controller.getAllAppScopes(query);
      expect(service.getAllAppScopes).toHaveBeenCalledWith(query);
    });
  });

  describe('updateAppScope', () => {
    it('should call service.updateAppScope with the correct data', async () => {
      const updateAppScopeDto: UpdateAppScopeDto = { id: '1', name: 'updated' };
      await controller.updateAppScope(updateAppScopeDto);
      expect(service.updateAppScope).toHaveBeenCalledWith('1', updateAppScopeDto);
    });
  });

  describe('deleteAppScope', () => {
    it('should call service.deleteAppScope with the correct id', async () => {
      const id = '1';
      await controller.deleteAppScope(id);
      expect(service.deleteAppScope).toHaveBeenCalledWith(id);
    });
  });
});
