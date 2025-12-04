import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
} from '@optimistic-tanuki/models';
import { profile } from 'console';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @InjectRepository(RoleAssignment)
    private roleAssignmentsRepository: Repository<RoleAssignment>,
    @InjectRepository(AppScope)
    private appScopesRepository: Repository<AppScope>,
    private readonly l: Logger
  ) {}

  async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
    this.l.log(`Creating role: ${createRoleDto.name}`);
    const appScope = await this.appScopesRepository.findOne({
      where: { id: createRoleDto.appScopeId },
    });

    const role = this.rolesRepository.create({
      name: createRoleDto.name,
      description: createRoleDto.description,
      appScope,
    });
    return await this.rolesRepository.save(role);
  }

  async getRole(id: string): Promise<Role> {
    return await this.rolesRepository.findOne({
      where: { id },
      relations: ['permissions', 'assignments', 'appScope'],
    });
  }

  async getRoleByName(name: string, appScope?: string): Promise<Role> {
    const queryBuilder = this.rolesRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .leftJoinAndSelect('role.appScope', 'appScope')
      .where('role.name = :name', { name });

    if (appScope) {
      queryBuilder.andWhere('appScope.name = :appScope', { appScope });
    }

    return await queryBuilder.getOne();
  }

  async getAllRoles(query: any): Promise<Role[]> {
    return await this.rolesRepository.find({
      ...query,
      relations: ['permissions', 'appScope'],
    });
  }

  async updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const updateData: any = {
      name: updateRoleDto.name,
      description: updateRoleDto.description,
    };

    if (updateRoleDto.appScopeId) {
      const appScope = await this.appScopesRepository.findOne({
        where: { id: updateRoleDto.appScopeId },
      });
      updateData.appScope = appScope;
    }

    await this.rolesRepository.update(id, updateData);
    return await this.getRole(id);
  }

  async deleteRole(id: string): Promise<void> {
    await this.rolesRepository.delete(id);
  }

  async addPermissionToRole(
    roleId: string,
    permissionId: string
  ): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: ['permissions', 'appScope'],
    });
    const permission = await this.permissionsRepository.findOne({
      where: { id: permissionId },
    });

    if (!role.permissions) {
      role.permissions = [];
    }

    if (!role.permissions.find((p) => p.id === permissionId)) {
      role.permissions.push(permission);
      await this.rolesRepository.save(role);
    }

    return role;
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string
  ): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: ['permissions', 'appScope'],
    });

    role.permissions = role.permissions.filter((p) => p.id !== permissionId);
    await this.rolesRepository.save(role);

    return role;
  }

  async assignRole(assignRoleDto: AssignRoleDto): Promise<RoleAssignment> {
    const role = await this.rolesRepository.findOne({
      where: { id: assignRoleDto.roleId },
    });

    const appScope = await this.appScopesRepository.findOne({
      where: { id: assignRoleDto.appScopeId },
    });

    const assignment = this.roleAssignmentsRepository.create({
      profileId: assignRoleDto.profileId,
      appScope,
      role,
    });

    return await this.roleAssignmentsRepository.save(assignment);
  }

  async unassignRole(assignmentId: string): Promise<void> {
    await this.roleAssignmentsRepository.delete(assignmentId);
  }

  async getUserRoles(
    profileId: string,
    appScopeId?: string
  ): Promise<RoleAssignment[]> {
    const queryBuilder = this.roleAssignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .leftJoinAndSelect('assignment.appScope', 'appScope')
      .where('assignment.profileId = :profileId', { profileId });

    return await queryBuilder.getMany();
  }

  async checkPermission(
    profileId: string,
    permissionName: string,
    appScopeId: string,
    profileAppScope?: string,
    targetId?: string
  ): Promise<boolean> {
    this.l.log(
      `Checking permission: ${permissionName} for profile ${profileId} in appScope ${appScopeId}`
    );
    const assignments = await this.getUserRoles(profileId, appScopeId);

    if (assignments.length === 0) {
      this.l.warn(
        `Permission denied: ${permissionName} for profile ${profileId} - No role assignments found`
      );
      return false;
    }

    for (const assignment of assignments) {
      this.l.debug('Checking assignment:', assignment);

      if (
        !assignment.role.permissions ||
        assignment.role.permissions.length === 0
      ) {
        this.l.debug(
          `Role ${assignment.role.name} has no permissions assigned`
        );
        continue;
      }

      for (const p of assignment.role.permissions) {
        if (permissionName === 'public') continue;
        this.l.debug('Evaluating permission:', p);
        this.l.debug('Against permissionName:', permissionName);
        this.l.debug('Against targetId:', targetId);
        this.l.debug('Against appScopeId:', appScopeId);
        this.l.debug('Against profileAppScope:', profileAppScope);

        const nameMatch =
          p.name === permissionName || p.action === permissionName;
        const targetMatch = !targetId || p.targetId === targetId || !p.targetId;

        if (!nameMatch) {
          this.l.debug(
            `Permission ${
              p.name || p.action
            } rejected - name/action does not match ${permissionName}`
          );
          continue;
        }

        if (!targetMatch) {
          this.l.debug(
            `Permission ${
              p.name || p.action
            } rejected - targetId mismatch (expected: ${targetId}, got: ${
              p.targetId
            })`
          );
          continue;
        }

        const hasGlobalScope = profileAppScope && profileAppScope === 'global';

        if (nameMatch && targetMatch) {
          this.l.log(
            `Permission granted: ${permissionName} for profile ${profileId} via role ${assignment.role.name}`
          );
          return true;
        }

        if (nameMatch && hasGlobalScope) {
          this.l.log(
            `Permission granted: ${permissionName} for profile ${profileId} via global scope`
          );
          return true;
        }
      }
    }

    this.l.warn(
      `Permission denied: ${permissionName} for profile ${profileId} - No matching permissions found in ${assignments.length} role(s)`
    );
    return false;
  }
}
