import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from '../app/roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from '@optimistic-tanuki/models';

describe('RolesController', () => {
  let controller: RolesController;
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: {
            createRole: jest.fn(),
            getRole: jest.fn(),
            getAllRoles: jest.fn(),
            updateRole: jest.fn(),
            deleteRole: jest.fn(),
            addPermissionToRole: jest.fn(),
            removePermissionFromRole: jest.fn(),
            assignRole: jest.fn(),
            unassignRole: jest.fn(),
            getUserRoles: jest.fn(),
            checkPermission: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRole', () => {
    it('should call service.createRole with the correct data', async () => {
      const createRoleDto: CreateRoleDto = { name: 'admin', description: 'Admin role', appScopeId: '1' };
      await controller.createRole(createRoleDto);
      expect(service.createRole).toHaveBeenCalledWith(createRoleDto);
    });
  });

  describe('getRole', () => {
    it('should call service.getRole with the correct id', async () => {
      const id = '1';
      await controller.getRole(id);
      expect(service.getRole).toHaveBeenCalledWith(id);
    });
  });

  describe('getAllRoles', () => {
    it('should call service.getAllRoles with the correct query', async () => {
      const query = { where: { name: 'admin' } };
      await controller.getAllRoles(query);
      expect(service.getAllRoles).toHaveBeenCalledWith(query);
    });
  });

  describe('updateRole', () => {
    it('should call service.updateRole with the correct data', async () => {
      const updateRoleDto: UpdateRoleDto = { id: '1', name: 'new name' };
      await controller.updateRole(updateRoleDto);
      expect(service.updateRole).toHaveBeenCalledWith('1', updateRoleDto);
    });
  });

  describe('deleteRole', () => {
    it('should call service.deleteRole with the correct id', async () => {
      const id = '1';
      await controller.deleteRole(id);
      expect(service.deleteRole).toHaveBeenCalledWith(id);
    });
  });

  describe('addPermissionToRole', () => {
    it('should call service.addPermissionToRole with correct ids', async () => {
      const data = { roleId: '1', permissionId: '1' };
      await controller.addPermissionToRole(data);
      expect(service.addPermissionToRole).toHaveBeenCalledWith('1', '1');
    });
  });

  describe('removePermissionFromRole', () => {
    it('should call service.removePermissionFromRole with correct ids', async () => {
      const data = { roleId: '1', permissionId: '1' };
      await controller.removePermissionFromRole(data);
      expect(service.removePermissionFromRole).toHaveBeenCalledWith('1', '1');
    });
  });

  describe('assignRole', () => {
    it('should call service.assignRole with the correct data', async () => {
      const assignRoleDto: AssignRoleDto = { roleId: '1', profileId: '1', appScopeId: '1' };
      await controller.assignRole(assignRoleDto);
      expect(service.assignRole).toHaveBeenCalledWith(assignRoleDto);
    });
  });

  describe('unassignRole', () => {
    it('should call service.unassignRole with the correct id', async () => {
      const data = { assignmentId: '1' };
      await controller.unassignRole(data);
      expect(service.unassignRole).toHaveBeenCalledWith('1');
    });
  });

  describe('getUserRoles', () => {
    it('should call service.getUserRoles with correct data', async () => {
      const data = { profileId: '1', appScope: 'global' };
      await controller.getUserRoles(data);
      expect(service.getUserRoles).toHaveBeenCalledWith('1', 'global');
    });
  });

  describe('checkPermission', () => {
    it('should call service.checkPermission with correct data', async () => {
      const data = { profileId: '1', permission: 'read', appScope: 'global', targetId: '1' };
      await controller.checkPermission(data);
      expect(service.checkPermission).toHaveBeenCalledWith('1', 'read', 'global', '1');
    });
  });
});
