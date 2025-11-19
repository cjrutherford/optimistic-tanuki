import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from '../app/permissions.service';
import { CreatePermissionDto, UpdatePermissionDto } from '@optimistic-tanuki/models';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let service: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: PermissionsService,
          useValue: {
            createPermission: jest.fn(),
            getPermission: jest.fn(),
            getAllPermissions: jest.fn(),
            updatePermission: jest.fn(),
            deletePermission: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PermissionsController>(PermissionsController);
    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPermission', () => {
    it('should call service.createPermission with the correct data', async () => {
      const createPermissionDto: CreatePermissionDto = { name: 'test:read', description: 'Test Read', resource: 'test', action: 'read' };
      await controller.createPermission(createPermissionDto);
      expect(service.createPermission).toHaveBeenCalledWith(createPermissionDto);
    });
  });

  describe('getPermission', () => {
    it('should call service.getPermission with the correct id', async () => {
      const id = '1';
      await controller.getPermission(id);
      expect(service.getPermission).toHaveBeenCalledWith(id);
    });
  });

  describe('getAllPermissions', () => {
    it('should call service.getAllPermissions with the correct query', async () => {
      const query = { where: { name: 'test' } };
      await controller.getAllPermissions(query);
      expect(service.getAllPermissions).toHaveBeenCalledWith(query);
    });
  });

  describe('updatePermission', () => {
    it('should call service.updatePermission with the correct data', async () => {
      const updatePermissionDto: UpdatePermissionDto = { id: '1', name: 'updated' };
      await controller.updatePermission(updatePermissionDto);
      expect(service.updatePermission).toHaveBeenCalledWith('1', updatePermissionDto);
    });
  });

  describe('deletePermission', () => {
    it('should call service.deletePermission with the correct id', async () => {
      const id = '1';
      await controller.deletePermission(id);
      expect(service.deletePermission).toHaveBeenCalledWith(id);
    });
  });
});
