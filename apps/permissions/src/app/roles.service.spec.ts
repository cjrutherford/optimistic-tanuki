import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';

describe('RolesService', () => {
  let service: RolesService;
  let rolesRepository: Repository<Role>;
  let permissionsRepository: Repository<Permission>;
  let roleAssignmentsRepository: Repository<RoleAssignment>;
  let appScopesRepository: Repository<AppScope>;

  const mockAppScope = {
    id: 'appscope1',
    name: 'test-scope',
    description: 'Test scope',
    active: true,
  };

  const mockPermission = {
    id: 'perm1',
    name: 'test.permission',
    description: 'Test permission',
    resource: 'test',
    action: 'read',
    appScopeId: 'appscope1',
    appScope: mockAppScope,
  };

  const mockRole = {
    id: 'role1',
    name: 'test-role',
    description: 'Test role',
    appScope: mockAppScope,
    permissions: [mockPermission],
  };

  const mockRoleAssignment = {
    id: 'assignment1',
    profileId: 'profile1',
    role: mockRole,
    appScope: mockAppScope,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        Logger,
        {
          provide: getRepositoryToken(Role),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RoleAssignment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AppScope),
          useValue: {
            findOne: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRole', () => {
    it('should create a new role', async () => {
      const createRoleDto = {
        name: 'test-role',
        description: 'Test role',
        appScopeId: 'appscope1',
      };

      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(mockAppScope as any);
      jest.spyOn(rolesRepository, 'create').mockReturnValue(mockRole as any);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(mockRole as any);

      const result = await service.createRole(createRoleDto);

      expect(result).toEqual(mockRole);
      expect(appScopesRepository.findOne).toHaveBeenCalledWith({
        where: { id: createRoleDto.appScopeId },
      });
      expect(rolesRepository.create).toHaveBeenCalled();
      expect(rolesRepository.save).toHaveBeenCalled();
    });
  });

  describe('getRole', () => {
    it('should return a role by id', async () => {
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(mockRole as any);

      const result = await service.getRole('role1');

      expect(result).toEqual(mockRole);
      expect(rolesRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'role1' },
        relations: ['permissions', 'assignments', 'appScope'],
      });
    });
  });

  describe('getAllRoles', () => {
    it('should return all roles', async () => {
      const roles = [mockRole];
      jest.spyOn(rolesRepository, 'find').mockResolvedValue(roles as any);

      const result = await service.getAllRoles({});

      expect(result).toEqual(roles);
      expect(rolesRepository.find).toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('should update a role', async () => {
      const updateRoleDto = {
        id: 'role1',
        name: 'updated-role',
        description: 'Updated role',
        appScopeId: 'appscope1',
      };

      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(mockAppScope as any);
      jest.spyOn(rolesRepository, 'update').mockResolvedValue(undefined);
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue({ ...mockRole, name: 'updated-role' } as any);

      const result = await service.updateRole('role1', updateRoleDto);

      expect(result.name).toBe('updated-role');
      expect(rolesRepository.update).toHaveBeenCalled();
    });
  });

  describe('deleteRole', () => {
    it('should delete a role', async () => {
      jest.spyOn(rolesRepository, 'delete').mockResolvedValue(undefined);

      await service.deleteRole('role1');

      expect(rolesRepository.delete).toHaveBeenCalledWith('role1');
    });
  });

  describe('addPermissionToRole', () => {
    it('should add a permission to a role', async () => {
      const roleWithoutPerm = { ...mockRole, permissions: [] };
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(roleWithoutPerm as any);
      jest.spyOn(permissionsRepository, 'findOne').mockResolvedValue(mockPermission as any);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue({ ...roleWithoutPerm, permissions: [mockPermission] } as any);

      const result = await service.addPermissionToRole('role1', 'perm1');

      expect(result.permissions).toContain(mockPermission);
      expect(rolesRepository.save).toHaveBeenCalled();
    });

    it('should not add duplicate permission to a role', async () => {
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(permissionsRepository, 'findOne').mockResolvedValue(mockPermission as any);

      const result = await service.addPermissionToRole('role1', 'perm1');

      expect(rolesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove a permission from a role', async () => {
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue({ ...mockRole, permissions: [] } as any);

      const result = await service.removePermissionFromRole('role1', 'perm1');

      expect(result.permissions).toHaveLength(0);
      expect(rolesRepository.save).toHaveBeenCalled();
    });
  });

  describe('assignRole', () => {
    it('should assign a role to a profile', async () => {
      const assignRoleDto = {
        profileId: 'profile1',
        roleId: 'role1',
        appScopeId: 'appscope1',
      };

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(mockRole as any);
      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(mockAppScope as any);
      jest.spyOn(roleAssignmentsRepository, 'create').mockReturnValue(mockRoleAssignment as any);
      jest.spyOn(roleAssignmentsRepository, 'save').mockResolvedValue(mockRoleAssignment as any);

      const result = await service.assignRole(assignRoleDto);

      expect(result).toEqual(mockRoleAssignment);
      expect(roleAssignmentsRepository.create).toHaveBeenCalled();
      expect(roleAssignmentsRepository.save).toHaveBeenCalled();
    });
  });

  describe('unassignRole', () => {
    it('should unassign a role from a profile', async () => {
      jest.spyOn(roleAssignmentsRepository, 'delete').mockResolvedValue(undefined);

      await service.unassignRole('assignment1');

      expect(roleAssignmentsRepository.delete).toHaveBeenCalledWith('assignment1');
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles for a profile', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRoleAssignment]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.getUserRoles('profile1', 'appscope1');

      expect(result).toEqual([mockRoleAssignment]);
      expect(queryBuilder.where).toHaveBeenCalledWith('assignment.profileId = :profileId', { profileId: 'profile1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('appScope.id = :appScopeId', { appScopeId: 'appscope1' });
    });

    it('should return user roles without appScope filter', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRoleAssignment]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.getUserRoles('profile1');

      expect(result).toEqual([mockRoleAssignment]);
      expect(queryBuilder.where).toHaveBeenCalledWith('assignment.profileId = :profileId', { profileId: 'profile1' });
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('checkPermission', () => {
    it('should return true when user has the permission', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRoleAssignment]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.checkPermission('profile1', 'test.permission', 'appscope1');

      expect(result).toBe(true);
    });

    it('should return false when user does not have the permission', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRoleAssignment]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.checkPermission('profile1', 'nonexistent.permission', 'appscope1');

      expect(result).toBe(false);
    });

    it('should return false when user has no role assignments', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.checkPermission('profile1', 'test.permission', 'appscope1');

      expect(result).toBe(false);
    });

    it('should match permission by action field', async () => {
      const roleWithActionPermission = {
        ...mockRoleAssignment,
        role: {
          ...mockRole,
          permissions: [{
            ...mockPermission,
            name: 'other.name',
            action: 'test.permission',
          }],
        },
      };

      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([roleWithActionPermission]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.checkPermission('profile1', 'test.permission', 'appscope1');

      expect(result).toBe(true);
    });

    it('should check targetId when provided', async () => {
      const permissionWithTarget = {
        ...mockPermission,
        targetId: 'target123',
      };

      const roleWithTargetPermission = {
        ...mockRoleAssignment,
        role: {
          ...mockRole,
          permissions: [permissionWithTarget],
        },
      };

      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([roleWithTargetPermission]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      // Should pass with matching targetId
      const result1 = await service.checkPermission('profile1', 'test.permission', 'appscope1', 'target123');
      expect(result1).toBe(true);

      // Should fail with non-matching targetId
      const result2 = await service.checkPermission('profile1', 'test.permission', 'appscope1', 'other-target');
      expect(result2).toBe(false);
    });

    it('should match when permission has no targetId', async () => {
      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRoleAssignment]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      // Permission has no targetId, so should match regardless of targetId in check
      const result = await service.checkPermission('profile1', 'test.permission', 'appscope1', 'any-target');
      expect(result).toBe(true);
    });

    it('should verify appScope matches', async () => {
      const permissionDifferentScope = {
        ...mockPermission,
        appScopeId: 'different-scope',
      };

      const roleWithDifferentScope = {
        ...mockRoleAssignment,
        role: {
          ...mockRole,
          permissions: [permissionDifferentScope],
        },
      };

      const queryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([roleWithDifferentScope]),
      };

      jest.spyOn(roleAssignmentsRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      // Should fail because permission is in different app scope
      const result = await service.checkPermission('profile1', 'test.permission', 'appscope1');
      expect(result).toBe(false);
    });
  });
});
