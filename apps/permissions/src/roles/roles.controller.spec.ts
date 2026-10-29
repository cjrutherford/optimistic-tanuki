import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from '../app/roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  BulkRoleMutationDto,
} from '@optimistic-tanuki/models';

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
            unassignRoleByTarget: jest.fn(),
            previewBulkRoleMutation: jest.fn(),
            executeBulkRoleMutation: jest.fn(),
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
      const createRoleDto: CreateRoleDto = {
        name: 'admin',
        description: 'Admin role',
        appScopeId: '1',
      };
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
      const assignRoleDto: AssignRoleDto = {
        roleId: '1',
        profileId: '1',
        appScopeId: '1',
      };
      await controller.assignRole(assignRoleDto);
      expect(service.assignRole).toHaveBeenCalledWith(assignRoleDto);
    });
  });

  describe('unassignRole', () => {
    it('acknowledges only after the exact assignment has been removed', async () => {
      const data = { assignmentId: 'assignment-1' };
      let finishRemoval!: () => void;
      jest.spyOn(service, 'unassignRole').mockImplementation(
        () =>
          new Promise<{ profileId: string; changed: boolean }>((resolve) => {
            finishRemoval = () =>
              resolve({ profileId: 'profile-1', changed: true });
          })
      );

      const acknowledgement = controller.unassignRole(data);
      await Promise.resolve();
      let settled = false;
      void acknowledgement.then(() => (settled = true));
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(service.unassignRole).toHaveBeenCalledWith(data.assignmentId);

      finishRemoval();
      await expect(acknowledgement).resolves.toEqual({
        success: true,
        assignmentId: data.assignmentId,
        profileId: 'profile-1',
        changed: true,
      });
    });
  });

  it('returns profile metadata after a target-scoped role removal', async () => {
    const data = {
      profileId: 'profile-1',
      roleId: 'role-1',
      appScopeId: 'scope-1',
      targetId: 'target-1',
    };
    jest.spyOn(service, 'unassignRoleByTarget').mockResolvedValue({
      profileId: 'profile-1',
    });

    await expect(controller.unassignRoleByTarget(data)).resolves.toEqual({
      profileId: 'profile-1',
    });
    expect(service.unassignRoleByTarget).toHaveBeenCalledWith(
      data.profileId,
      data.roleId,
      data.appScopeId,
      data.targetId
    );
  });

  describe('previewBulkRoleMutation', () => {
    it('should call service.previewBulkRoleMutation with the correct data', async () => {
      const bulkRoleMutationDto: BulkRoleMutationDto = {
        operation: 'assign',
        roleId: 'role-1',
        profileIds: ['profile-1', 'profile-2'],
        appScopeId: 'scope-1',
      };

      await controller.previewBulkRoleMutation(bulkRoleMutationDto);

      expect(service.previewBulkRoleMutation).toHaveBeenCalledWith(
        bulkRoleMutationDto
      );
    });
  });

  describe('executeBulkRoleMutation', () => {
    it('should call service.executeBulkRoleMutation with the correct data', async () => {
      const bulkRoleMutationDto: BulkRoleMutationDto = {
        operation: 'unassign',
        roleId: 'role-1',
        profileIds: ['profile-1', 'profile-2'],
        appScopeId: 'scope-1',
      };

      await controller.executeBulkRoleMutation(bulkRoleMutationDto);

      expect(service.executeBulkRoleMutation).toHaveBeenCalledWith(
        bulkRoleMutationDto
      );
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
      const data = {
        profileId: '1',
        permission: 'read',
        appScopeId: 'global',
        targetId: '1',
      };
      await controller.checkPermission(data);
      expect(service.checkPermission).toHaveBeenCalledWith(
        '1',
        'read',
        'global',
        undefined,
        '1',
        false
      );
    });

    it('should pass checkGlobalFallback parameter when provided', async () => {
      const data = {
        profileId: '1',
        permission: 'read',
        appScopeId: 'global',
        targetId: '1',
        checkGlobalFallback: true,
      };
      await controller.checkPermission(data);
      expect(service.checkPermission).toHaveBeenCalledWith(
        '1',
        'read',
        'global',
        undefined,
        '1',
        true
      );
    });

    it('should pass profileAppScope parameter when provided', async () => {
      const data = {
        profileId: '1',
        permission: 'read',
        appScopeId: 'global',
        profileAppScope: 'forgeofwill',
        targetId: '1',
      };
      await controller.checkPermission(data);
      expect(service.checkPermission).toHaveBeenCalledWith(
        '1',
        'read',
        'global',
        'forgeofwill',
        '1',
        false
      );
    });
  });
});
