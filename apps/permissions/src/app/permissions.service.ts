import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Permission } from '../permissions/entities/permission.entity';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
} from '@optimistic-tanuki/models';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @InjectRepository(RoleAssignment)
    private roleAssignmentsRepository: Repository<RoleAssignment>
  ) { }

  async createPermission(
    createPermissionDto: CreatePermissionDto
  ): Promise<Permission> {
    const permission = this.permissionsRepository.create(createPermissionDto);
    return await this.permissionsRepository.save(permission);
  }

  async getPermission(id: string): Promise<Permission> {
    return await this.permissionsRepository.findOne({
      where: { id },
      relations: ['roles', 'appScope'],
    });
  }

  async getAllPermissions(query: any): Promise<Permission[]> {
    return await this.permissionsRepository.find(query);
  }

  async updatePermission(
    id: string,
    updatePermissionDto: UpdatePermissionDto
  ): Promise<Permission> {
    await this.permissionsRepository.update(id, updatePermissionDto);
    return await this.getPermission(id);
  }

  async deletePermission(id: string): Promise<void> {
    await this.permissionsRepository.delete(id);
  }

  async searchPermissions(query: string, profileId: string): Promise<string[]> {
    const userRoles = await this.roleAssignmentsRepository.find({
      where: { profileId },
      relations: ['role'],
    });

    const roleIds = userRoles.map((assignment) => assignment.roleId);

    const permissions = await this.permissionsRepository
      .find({
        where: {
          name: Like(`${query}%`),
          roles: {
            id: In(roleIds),
          },
        },
        relations: ['roles'],
      });

    return permissions.map((perm) => perm.name);
  }
}
