import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { Permission } from '../permissions/entities/permission.entity';
import { CreatePermissionDto, UpdatePermissionDto } from '@optimistic-tanuki/models';

const mockPermissionsRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repository: Repository<Permission>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(Permission),
          useFactory: mockPermissionsRepository,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    repository = module.get<Repository<Permission>>(getRepositoryToken(Permission));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPermission', () => {
    it('should create and save a new permission', async () => {
      const createPermissionDto: CreatePermissionDto = { name: 'test:read', description: 'Test Read', resource: 'test', action: 'read' };
      const permission = new Permission();

      jest.spyOn(repository, 'create').mockReturnValue(permission);
      jest.spyOn(repository, 'save').mockResolvedValue(permission);

      const result = await service.createPermission(createPermissionDto);

      expect(repository.create).toHaveBeenCalledWith(createPermissionDto);
      expect(repository.save).toHaveBeenCalledWith(permission);
      expect(result).toEqual(permission);
    });
  });

  describe('getPermission', () => {
    it('should return a permission if it exists', async () => {
      const permission = new Permission();
      permission.id = '1';
      jest.spyOn(repository, 'findOne').mockResolvedValue(permission);

      const result = await service.getPermission('1');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: ['roles'] });
      expect(result).toEqual(permission);
    });
  });

  describe('getAllPermissions', () => {
    it('should return an array of permissions', async () => {
      const permissions = [new Permission()];
      jest.spyOn(repository, 'find').mockResolvedValue(permissions);

      const result = await service.getAllPermissions({});

      expect(repository.find).toHaveBeenCalledWith({});
      expect(result).toEqual(permissions);
    });
  });

  describe('updatePermission', () => {
    it('should update a permission and return it', async () => {
      const updatePermissionDto: UpdatePermissionDto = { id: '1', name: 'updated' };
      const permission = new Permission();
      permission.id = '1';

      jest.spyOn(repository, 'update').mockResolvedValue(undefined);
      jest.spyOn(service, 'getPermission').mockResolvedValue(permission);

      const result = await service.updatePermission('1', updatePermissionDto);

      expect(repository.update).toHaveBeenCalledWith('1', updatePermissionDto);
      expect(service.getPermission).toHaveBeenCalledWith('1');
      expect(result).toEqual(permission);
    });
  });

  describe('deletePermission', () => {
    it('should delete a permission', async () => {
      jest.spyOn(repository, 'delete').mockResolvedValue(undefined);

      await service.deletePermission('1');

      expect(repository.delete).toHaveBeenCalledWith('1');
    });
  });
});
