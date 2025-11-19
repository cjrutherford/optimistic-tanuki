import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { Permission } from '../permissions/entities/permission.entity';
import { CreatePermissionDto, UpdatePermissionDto } from '@optimistic-tanuki/models';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repository: Repository<Permission>;

  const mockPermission = {
    id: 'perm1',
    name: 'test.permission',
    description: 'Test permission',
    resource: 'test',
    action: 'read',
    targetId: null,
    appScopeId: 'scope1',
    created_at: new Date(),
    roles: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(Permission),
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

    service = module.get<PermissionsService>(PermissionsService);
    repository = module.get<Repository<Permission>>(
      getRepositoryToken(Permission)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPermission', () => {
    it('should create a new permission', async () => {
      const createPermissionDto: CreatePermissionDto = {
        name: 'test.permission',
        description: 'Test permission',
        resource: 'test',
        action: 'read',
      };

      jest.spyOn(repository, 'create').mockReturnValue(mockPermission as any);
      jest.spyOn(repository, 'save').mockResolvedValue(mockPermission as any);

      const result = await service.createPermission(createPermissionDto);

      expect(result).toEqual(mockPermission);
      expect(repository.create).toHaveBeenCalledWith(createPermissionDto);
      expect(repository.save).toHaveBeenCalledWith(mockPermission);
    });
  });

  describe('getPermission', () => {
    it('should return a permission by id', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockPermission as any);

      const result = await service.getPermission('perm1');

      expect(result).toEqual(mockPermission);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'perm1' },
        relations: ['roles'],
      });
    });

    it('should return undefined if permission not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(undefined);

      const result = await service.getPermission('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllPermissions', () => {
    it('should return all permissions', async () => {
      const permissions = [mockPermission];
      jest.spyOn(repository, 'find').mockResolvedValue(permissions as any);

      const result = await service.getAllPermissions({});

      expect(result).toEqual(permissions);
      expect(repository.find).toHaveBeenCalledWith({});
    });

    it('should return permissions with query filters', async () => {
      const permissions = [mockPermission];
      const query = { where: { resource: 'test' } };
      jest.spyOn(repository, 'find').mockResolvedValue(permissions as any);

      const result = await service.getAllPermissions(query);

      expect(result).toEqual(permissions);
      expect(repository.find).toHaveBeenCalledWith(query);
    });

    it('should return empty array if no permissions exist', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      const result = await service.getAllPermissions({});

      expect(result).toEqual([]);
    });
  });

  describe('updatePermission', () => {
    it('should update a permission', async () => {
      const updatePermissionDto: UpdatePermissionDto = {
        id: 'perm1',
        description: 'Updated description',
      };

      const updatedPermission = {
        ...mockPermission,
        description: 'Updated description',
      };

      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(repository, 'findOne').mockResolvedValue(updatedPermission as any);

      const result = await service.updatePermission('perm1', updatePermissionDto);

      expect(result).toEqual(updatedPermission);
      expect(repository.update).toHaveBeenCalledWith('perm1', updatePermissionDto);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'perm1' },
        relations: ['roles'],
      });
    });
  });

  describe('deletePermission', () => {
    it('should delete a permission', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await service.deletePermission('perm1');

      expect(repository.delete).toHaveBeenCalledWith('perm1');
    });
  });
});
