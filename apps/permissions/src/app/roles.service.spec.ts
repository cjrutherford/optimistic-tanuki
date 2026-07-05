import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesService } from './roles.service';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  BulkRoleMutationDto,
} from '@optimistic-tanuki/models';
import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  })),
});

describe('RolesService', () => {
  let service: RolesService;
  let rolesRepository: Repository<Role>;
  let permissionsRepository: Repository<Permission>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;
  let appScopesRepository: Repository<AppScope>;
  let getMany: jest.Mock;
  let getOne: jest.Mock;
  let andWhere: jest.Mock;
  let where: jest.Mock;
  let leftJoinAndSelect: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useFactory: mockRepo },
        { provide: getRepositoryToken(Permission), useFactory: mockRepo },
        { provide: getRepositoryToken(RoleAssignment), useFactory: mockRepo },
        { provide: getRepositoryToken(AppScope), useFactory: mockRepo },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    rolesRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    permissionsRepository = module.get<Repository<Permission>>(
      getRepositoryToken(Permission)
    );
    roleAssignmentsRepository = module.get<Repository<RoleAssignment>>(
      getRepositoryToken(RoleAssignment)
    );
    appScopesRepository = module.get<Repository<AppScope>>(
      getRepositoryToken(AppScope)
    );

    getMany = jest.fn();
    getOne = jest.fn();
    andWhere = jest.fn().mockReturnThis();
    where = jest.fn().mockReturnThis();
    leftJoinAndSelect = jest.fn().mockReturnThis();

    jest
      .spyOn(roleAssignmentsRepository, 'createQueryBuilder')
      .mockReturnValue({
        leftJoinAndSelect,
        where,
        andWhere,
        getMany,
      } as any);

    // Also spy on rolesRepository.createQueryBuilder for getRoleByName
    jest.spyOn(rolesRepository, 'createQueryBuilder').mockReturnValue({
      leftJoinAndSelect,
      where,
      andWhere,
      getOne,
      getMany,
    } as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const createAppScope = new AppScope();
      const createRoleDto: CreateRoleDto = {
        name: 'admin',
        description: 'Admin role',
        appScopeId: '1',
      };
      const role = new Role();

      jest
        .spyOn(appScopesRepository, 'findOne')
        .mockResolvedValue(createAppScope);
      jest.spyOn(rolesRepository, 'create').mockReturnValue(role);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(role);

      const result = await service.createRole(createRoleDto);
      expect(result).toEqual(role);
    });

    it('should return existing role when name already exists', async () => {
      const createRoleDto: CreateRoleDto = {
        name: 'admin',
        description: 'Admin role',
        appScopeId: '1',
      };
      const existingRole = new Role();
      existingRole.name = 'admin';

      jest
        .spyOn(rolesRepository, 'findOne')
        .mockResolvedValueOnce(existingRole as any);

      const result = await service.createRole(createRoleDto);

      expect(result).toBe(existingRole);
      expect(rolesRepository.create).not.toHaveBeenCalled();
      expect(rolesRepository.save).not.toHaveBeenCalled();
    });

    it('should return concurrently created role on duplicate key', async () => {
      const createAppScope = new AppScope();
      const createRoleDto: CreateRoleDto = {
        name: 'admin',
        description: 'Admin role',
        appScopeId: '1',
      };
      const role = new Role();
      role.name = 'admin';
      const duplicateError = new QueryFailedError('INSERT', [], {
        code: '23505',
      } as any);

      jest
        .spyOn(rolesRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(role as any);
      jest
        .spyOn(appScopesRepository, 'findOne')
        .mockResolvedValue(createAppScope);
      jest.spyOn(rolesRepository, 'create').mockReturnValue(role);
      jest.spyOn(rolesRepository, 'save').mockRejectedValue(duplicateError);

      const result = await service.createRole(createRoleDto);

      expect(result).toBe(role);
    });
  });

  describe('getRole', () => {
    it('should return a role', async () => {
      const role = new Role();
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      const result = await service.getRole('1');
      expect(result).toEqual(role);
    });

    it('should return null if role not found', async () => {
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(null);
      const result = await service.getRole('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getRoleByName', () => {
    it('should return a role by name', async () => {
      const role = new Role();
      getOne.mockResolvedValue(role);

      const result = await service.getRoleByName('admin');
      expect(result).toEqual(role);
      expect(where).toHaveBeenCalledWith('role.name = :name', {
        name: 'admin',
      });
    });

    it('should return a role by name with appScope', async () => {
      const role = new Role();
      getOne.mockResolvedValue(role);

      const result = await service.getRoleByName('admin', 'app1');
      expect(result).toEqual(role);
      expect(where).toHaveBeenCalledWith('role.name = :name', {
        name: 'admin',
      });
      expect(andWhere).toHaveBeenCalledWith('appScope.name = :appScope', {
        appScope: 'app1',
      });
    });

    it('should return null if role not found by name', async () => {
      getOne.mockResolvedValue(null);

      const result = await service.getRoleByName('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getAllRoles', () => {
    it('should return an array of roles', async () => {
      const roles = [new Role()];
      jest.spyOn(rolesRepository, 'find').mockResolvedValue(roles);
      const result = await service.getAllRoles({});
      expect(result).toEqual(roles);
    });
  });

  describe('updateRole', () => {
    it('should update a role', async () => {
      const updateRoleDto: UpdateRoleDto = { id: '1', name: 'new name' };
      const role = new Role();
      jest.spyOn(rolesRepository, 'update').mockResolvedValue(undefined);
      jest.spyOn(service, 'getRole').mockResolvedValue(role);
      const result = await service.updateRole('1', updateRoleDto);
      expect(result).toEqual(role);
    });

    it('should update a role with appScopeId', async () => {
      const updateRoleDto: UpdateRoleDto = {
        id: '1',
        name: 'new name',
        appScopeId: '1',
      };
      const role = new Role();
      const appScope = new AppScope();
      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(appScope);
      jest.spyOn(rolesRepository, 'update').mockResolvedValue(undefined);
      jest.spyOn(service, 'getRole').mockResolvedValue(role);
      const result = await service.updateRole('1', updateRoleDto);
      expect(result).toEqual(role);
    });
  });

  describe('deleteRole', () => {
    it('should delete a role', async () => {
      jest.spyOn(rolesRepository, 'delete').mockResolvedValue(undefined);
      await service.deleteRole('1');
      expect(rolesRepository.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('addPermissionToRole', () => {
    it('should add a permission to a role', async () => {
      const role = new Role();
      role.permissions = [];
      const permission = new Permission();
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest
        .spyOn(permissionsRepository, 'findOne')
        .mockResolvedValue(permission);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(role);

      const result = await service.addPermissionToRole('1', '1');
      expect(result.permissions).toContain(permission);
    });

    it('should not add a permission to a role if it already exists', async () => {
      const role = new Role();
      const permission = new Permission();
      permission.id = '1';
      role.permissions = [permission];

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest
        .spyOn(permissionsRepository, 'findOne')
        .mockResolvedValue(permission);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(role);

      const result = await service.addPermissionToRole('1', '1');
      expect(result.permissions.length).toBe(1);
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove a permission from a role', async () => {
      const role = new Role();
      const permission = new Permission();
      permission.id = 'p1';
      role.permissions = [permission];
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(role);

      const result = await service.removePermissionFromRole('1', 'p1');
      expect(result.permissions).not.toContain(permission);
    });
  });

  describe('assignRole', () => {
    it('should assign a role to a user', async () => {
      const assignRoleDto: AssignRoleDto = {
        roleId: '1',
        profileId: '1',
        appScopeId: '1',
      };
      const role = new Role();
      const appScope = new AppScope();
      const assignment = new RoleAssignment();

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(appScope);
      jest
        .spyOn(roleAssignmentsRepository, 'create')
        .mockReturnValue(assignment);
      jest
        .spyOn(roleAssignmentsRepository, 'save')
        .mockResolvedValue(assignment);

      const result = await service.assignRole(assignRoleDto);
      expect(result).toEqual(assignment);
    });

    it('should return existing assignment when already assigned', async () => {
      const assignRoleDto: AssignRoleDto = {
        roleId: '1',
        profileId: '1',
        appScopeId: '1',
      };
      const existingAssignment = new RoleAssignment();

      jest
        .spyOn(roleAssignmentsRepository, 'findOne')
        .mockResolvedValueOnce(existingAssignment as any);

      const result = await service.assignRole(assignRoleDto);

      expect(result).toBe(existingAssignment);
      expect(roleAssignmentsRepository.create).not.toHaveBeenCalled();
      expect(roleAssignmentsRepository.save).not.toHaveBeenCalled();
    });

    it('should return concurrently created assignment on duplicate key', async () => {
      const assignRoleDto: AssignRoleDto = {
        roleId: '1',
        profileId: '1',
        appScopeId: '1',
      };
      const role = new Role();
      const appScope = new AppScope();
      const assignment = new RoleAssignment();
      const duplicateError = new QueryFailedError('INSERT', [], {
        code: '23505',
      } as any);

      jest
        .spyOn(roleAssignmentsRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(assignment as any);
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(appScope);
      jest
        .spyOn(roleAssignmentsRepository, 'create')
        .mockReturnValue(assignment);
      jest
        .spyOn(roleAssignmentsRepository, 'save')
        .mockRejectedValue(duplicateError);

      const result = await service.assignRole(assignRoleDto);

      expect(result).toBe(assignment);
    });
  });

  describe('unassignRole', () => {
    it('should unassign a role from a user', async () => {
      jest
        .spyOn(roleAssignmentsRepository, 'delete')
        .mockResolvedValue(undefined);
      await service.unassignRole('1');
      expect(roleAssignmentsRepository.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('previewBulkRoleMutation', () => {
    it('summarizes assign impact across selected profiles', async () => {
      const dto: BulkRoleMutationDto = {
        operation: 'assign',
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileIds: ['profile-1', 'profile-2', 'profile-3'],
      };
      const role = new Role();
      role.id = 'role-1';
      role.name = 'owner_console_owner';

      const existingAssignment = new RoleAssignment();
      existingAssignment.id = 'assignment-1';
      existingAssignment.profileId = 'profile-2';

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest
        .spyOn(roleAssignmentsRepository, 'find')
        .mockResolvedValue([existingAssignment]);
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([]);

      const result = await service.previewBulkRoleMutation(dto);

      expect(result.operation).toBe('assign');
      expect(result.totalSelected).toBe(3);
      expect(result.affectedCount).toBe(2);
      expect(result.unchangedCount).toBe(1);
      expect(result.affectedProfileIds).toEqual(['profile-1', 'profile-3']);
      expect(result.unchangedProfileIds).toEqual(['profile-2']);
      expect(result.existingAssignmentIds).toEqual(['assignment-1']);
    });

    it('explains whether assigning the role adds new permissions or duplicates existing access', async () => {
      const dto: BulkRoleMutationDto = {
        operation: 'assign',
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileIds: ['profile-1'],
      };
      const role = new Role();
      role.id = 'role-1';
      role.name = 'owner_console_owner';
      role.permissions = [
        {
          id: 'perm-1',
          name: 'users.update',
          description: 'Update users',
          resource: 'users',
          action: 'update',
        } as Permission,
        {
          id: 'perm-2',
          name: 'roles.update',
          description: 'Update roles',
          resource: 'roles',
          action: 'update',
        } as Permission,
      ];

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(roleAssignmentsRepository, 'find').mockResolvedValue([]);
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([
        {
          role: {
            name: 'existing_operator',
            permissions: [role.permissions[0]],
          },
        } as RoleAssignment,
      ]);

      const result = await service.previewBulkRoleMutation(dto);

      expect(result.profileImpacts[0].permissionChanges).toEqual([
        expect.objectContaining({
          permissionName: 'users.update',
          status: 'already-present',
        }),
        expect.objectContaining({
          permissionName: 'roles.update',
          status: 'added',
        }),
      ]);
      expect(result.permissionChangeSummary).toEqual([
        expect.objectContaining({
          permissionName: 'users.update',
          status: 'already-present',
          affectedProfileCount: 1,
        }),
        expect.objectContaining({
          permissionName: 'roles.update',
          status: 'added',
          affectedProfileCount: 1,
        }),
      ]);
    });

    it('summarizes unassign impact across selected profiles', async () => {
      const dto: BulkRoleMutationDto = {
        operation: 'unassign',
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileIds: ['profile-1', 'profile-2'],
      };
      const role = new Role();
      role.id = 'role-1';
      role.name = 'owner_console_owner';

      const existingAssignment = new RoleAssignment();
      existingAssignment.id = 'assignment-1';
      existingAssignment.profileId = 'profile-1';

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest
        .spyOn(roleAssignmentsRepository, 'find')
        .mockResolvedValue([existingAssignment]);
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([
        {
          roleId: 'role-1',
          role,
        } as RoleAssignment,
      ]);

      const result = await service.previewBulkRoleMutation(dto);

      expect(result.operation).toBe('unassign');
      expect(result.affectedCount).toBe(1);
      expect(result.unchangedCount).toBe(1);
      expect(result.affectedProfileIds).toEqual(['profile-1']);
      expect(result.unchangedProfileIds).toEqual(['profile-2']);
      expect(result.existingAssignmentIds).toEqual(['assignment-1']);
    });

    it('explains whether removing the role revokes permissions or leaves them covered elsewhere', async () => {
      const dto: BulkRoleMutationDto = {
        operation: 'unassign',
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileIds: ['profile-1'],
      };
      const role = new Role();
      role.id = 'role-1';
      role.name = 'owner_console_owner';
      role.permissions = [
        {
          id: 'perm-1',
          name: 'users.update',
          description: 'Update users',
          resource: 'users',
          action: 'update',
        } as Permission,
        {
          id: 'perm-2',
          name: 'roles.update',
          description: 'Update roles',
          resource: 'roles',
          action: 'update',
        } as Permission,
      ];

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(roleAssignmentsRepository, 'find').mockResolvedValue([
        {
          id: 'assignment-1',
          profileId: 'profile-1',
        } as RoleAssignment,
      ]);
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([
        {
          roleId: 'role-1',
          role,
        } as RoleAssignment,
        {
          roleId: 'role-2',
          role: {
            name: 'backup_operator',
            permissions: [role.permissions[0]],
          },
        } as RoleAssignment,
      ]);

      const result = await service.previewBulkRoleMutation(dto);

      expect(result.profileImpacts[0].permissionChanges).toEqual([
        expect.objectContaining({
          permissionName: 'users.update',
          status: 'retained',
        }),
        expect.objectContaining({
          permissionName: 'roles.update',
          status: 'removed',
        }),
      ]);
      expect(result.permissionChangeSummary).toEqual([
        expect.objectContaining({
          permissionName: 'users.update',
          status: 'retained',
          affectedProfileCount: 1,
        }),
        expect.objectContaining({
          permissionName: 'roles.update',
          status: 'removed',
          affectedProfileCount: 1,
        }),
      ]);
    });
  });

  describe('executeBulkRoleMutation', () => {
    it('assigns only profiles that are not already assigned', async () => {
      const dto: BulkRoleMutationDto = {
        operation: 'assign',
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileIds: ['profile-1', 'profile-2'],
      };

      jest.spyOn(service, 'previewBulkRoleMutation').mockResolvedValue({
        operation: 'assign',
        roleId: 'role-1',
        roleName: 'owner_console_owner',
        appScopeId: 'scope-1',
        totalSelected: 2,
        affectedCount: 1,
        unchangedCount: 1,
        affectedProfileIds: ['profile-1'],
        unchangedProfileIds: ['profile-2'],
        existingAssignmentIds: [],
        permissionChangeSummary: [],
        profileImpacts: [],
      });
      const assignSpy = jest
        .spyOn(service, 'assignRole')
        .mockResolvedValue(new RoleAssignment());

      const result = await service.executeBulkRoleMutation(dto);

      expect(assignSpy).toHaveBeenCalledTimes(1);
      expect(assignSpy).toHaveBeenCalledWith({
        roleId: 'role-1',
        profileId: 'profile-1',
        appScopeId: 'scope-1',
        targetId: undefined,
      });
      expect(result.completedCount).toBe(1);
    });

    it('unassigns only matching assignments from the preview set', async () => {
      const dto: BulkRoleMutationDto = {
        operation: 'unassign',
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileIds: ['profile-1', 'profile-2'],
      };

      jest.spyOn(service, 'previewBulkRoleMutation').mockResolvedValue({
        operation: 'unassign',
        roleId: 'role-1',
        roleName: 'owner_console_owner',
        appScopeId: 'scope-1',
        totalSelected: 2,
        affectedCount: 1,
        unchangedCount: 1,
        affectedProfileIds: ['profile-2'],
        unchangedProfileIds: ['profile-1'],
        existingAssignmentIds: ['assignment-2'],
        permissionChangeSummary: [],
        profileImpacts: [],
      });
      const unassignSpy = jest
        .spyOn(service, 'unassignRole')
        .mockResolvedValue(undefined);

      const result = await service.executeBulkRoleMutation(dto);

      expect(unassignSpy).toHaveBeenCalledTimes(1);
      expect(unassignSpy).toHaveBeenCalledWith('assignment-2');
      expect(result.completedCount).toBe(1);
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      const assignments = [new RoleAssignment()];
      getMany.mockResolvedValue(assignments);

      const result = await service.getUserRoles('1');
      expect(result).toEqual(assignments);
    });

    it('should return user roles for a specific app scope', async () => {
      const assignments = [new RoleAssignment()];
      getMany.mockResolvedValue(assignments);

      const result = await service.getUserRoles('1', '1');
      expect(andWhere).toHaveBeenCalledWith(
        '(appScope.name = :appScopeName OR appScope.name = :globalScope)',
        {
          appScopeName: '1',
          globalScope: 'global',
        }
      );
      expect(result).toEqual(assignments);
    });
  });

  describe('checkPermission', () => {
    it('should return true if user has permission by name', async () => {
      const permission = new Permission();
      permission.name = 'test:read';
      const role = new Role();
      role.permissions = [permission];
      const assignment = new RoleAssignment();
      assignment.role = role;

      jest.spyOn(service, 'getUserRoles').mockResolvedValue([assignment]);

      const result = await service.checkPermission('1', 'test:read', '1');
      expect(result).toBe(true);
    });

    it('should return true if user has permission by action', async () => {
      const permission = new Permission();
      permission.action = 'read';
      const role = new Role();
      role.permissions = [permission];
      const assignment = new RoleAssignment();
      assignment.role = role;

      jest.spyOn(service, 'getUserRoles').mockResolvedValue([assignment]);

      const result = await service.checkPermission('1', 'read', '1');
      expect(result).toBe(true);
    });

    it('should return true if user has permission by permission targetId', async () => {
      const permission = new Permission();
      permission.name = 'test:read';
      permission.targetId = 'target';
      const role = new Role();
      role.permissions = [permission];
      const assignment = new RoleAssignment();
      assignment.role = role;

      jest.spyOn(service, 'getUserRoles').mockResolvedValue([assignment]);

      const result = await service.checkPermission(
        '1',
        'test:read',
        '1',
        undefined,
        'target'
      );
      expect(result).toBe(true);
    });

    it('should return true if role assignment target matches the requested target', async () => {
      const permission = new Permission();
      permission.name = 'test:read';
      const role = new Role();
      role.permissions = [permission];
      const assignment = new RoleAssignment();
      assignment.role = role;
      assignment.targetId = 'community-1';

      jest.spyOn(service, 'getUserRoles').mockResolvedValue([assignment]);

      const result = await service.checkPermission(
        '1',
        'test:read',
        '1',
        undefined,
        'community-1'
      );

      expect(result).toBe(true);
    });

    it('should return false if role assignment target does not match the requested target', async () => {
      const permission = new Permission();
      permission.name = 'test:read';
      const role = new Role();
      role.permissions = [permission];
      const assignment = new RoleAssignment();
      assignment.role = role;
      assignment.targetId = 'community-1';

      jest.spyOn(service, 'getUserRoles').mockResolvedValue([assignment]);

      const result = await service.checkPermission(
        '1',
        'test:read',
        '1',
        undefined,
        'community-2'
      );

      expect(result).toBe(false);
    });

    it('should return false if user does not have permission', async () => {
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([]);
      const result = await service.checkPermission('1', 'test:read', '1');
      expect(result).toBe(false);
    });
  });
});
