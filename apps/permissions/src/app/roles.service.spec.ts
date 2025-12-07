import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesService } from './roles.service';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { CreateRoleDto, UpdateRoleDto, AssignRoleDto } from '@optimistic-tanuki/models';
import { Logger } from '@nestjs/common';

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
        { provide: Logger, useValue: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } },
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const createAppScope = new AppScope();
      const createRoleDto: CreateRoleDto = { name: 'admin', description: 'Admin role', appScopeId: '1' };
      const role = new Role();

      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(createAppScope);
      jest.spyOn(rolesRepository, 'create').mockReturnValue(role);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(role);

      const result = await service.createRole(createRoleDto);
      expect(result).toEqual(role);
    });
  });

  describe('getRole', () => {
    it('should return a role', async () => {
      const role = new Role();
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      const result = await service.getRole('1');
      expect(result).toEqual(role);
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
      const updateRoleDto: UpdateRoleDto = { id: '1', name: 'new name', appScopeId: '1' };
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
      jest.spyOn(permissionsRepository, 'findOne').mockResolvedValue(permission);
      jest.spyOn(rolesRepository, 'save').mockResolvedValue(role);

      const result = await service.addPermissionToRole('1', '1');
      expect(result.permissions).toContain(permission);
    });
    
    it('should not add a permission to a role if it already exists', async () => {
      const role = new Role();
      const permission = new Permission();
      permission.id = '1'
      role.permissions = [permission];
      
      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(permissionsRepository, 'findOne').mockResolvedValue(permission);
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
      const assignRoleDto: AssignRoleDto = { roleId: '1', profileId: '1', appScopeId: '1' };
      const role = new Role();
      const appScope = new AppScope();
      const assignment = new RoleAssignment();

      jest.spyOn(rolesRepository, 'findOne').mockResolvedValue(role);
      jest.spyOn(appScopesRepository, 'findOne').mockResolvedValue(appScope);
      jest.spyOn(roleAssignmentsRepository, 'create').mockReturnValue(assignment);
      jest.spyOn(roleAssignmentsRepository, 'save').mockResolvedValue(assignment);

      const result = await service.assignRole(assignRoleDto);
      expect(result).toEqual(assignment);
    });
  });

  describe('unassignRole', () => {
    it('should unassign a role from a user', async () => {
      jest.spyOn(roleAssignmentsRepository, 'delete').mockResolvedValue(undefined);
      await service.unassignRole('1');
      expect(roleAssignmentsRepository.delete).toHaveBeenCalledWith('1');
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
      expect(andWhere).toHaveBeenCalledWith('appScope.id = :appScopeId', {
        appScopeId: '1',
      });
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
    
    it('should return true if user has permission by targetId', async () => {
      const permission = new Permission();
      permission.name = 'test:read';
      permission.targetId = 'target';
      const role = new Role();
      role.permissions = [permission];
      const assignment = new RoleAssignment();
      assignment.role = role;
      
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([assignment]);

      const result = await service.checkPermission('1', 'test:read', '1', 'target');
      expect(result).toBe(true);
    });

    it('should return false if user does not have permission', async () => {
      jest.spyOn(service, 'getUserRoles').mockResolvedValue([]);
      const result = await service.checkPermission('1', 'test:read', '1');
      expect(result).toBe(false);
    });
  });
});
