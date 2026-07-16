import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  BulkRoleMutationDto,
  BulkRoleMutationPermissionChangeDto,
  BulkRoleMutationProfileImpactDto,
  BulkRoleMutationPreviewDto,
  BulkRoleMutationResultDto,
} from '@optimistic-tanuki/models';

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
    const existingRole = await this.rolesRepository.findOne({
      where: { name: createRoleDto.name },
      relations: ['permissions', 'appScope'],
    });
    if (existingRole) {
      this.l.debug(`Role ${createRoleDto.name} already exists, reusing it`);
      return existingRole;
    }

    const appScope = await this.appScopesRepository.findOne({
      where: { id: createRoleDto.appScopeId },
    });

    const role = this.rolesRepository.create({
      name: createRoleDto.name,
      description: createRoleDto.description,
      appScope,
    });
    try {
      return await this.rolesRepository.save(role);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const duplicateRole = await this.rolesRepository.findOne({
          where: { name: createRoleDto.name },
          relations: ['permissions', 'appScope'],
        });
        if (duplicateRole) {
          this.l.debug(
            `Role ${createRoleDto.name} was created concurrently, reusing it`
          );
          return duplicateRole;
        }
      }
      throw error;
    }
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
    const existingAssignment = await this.roleAssignmentsRepository.findOne({
      where: {
        profileId: assignRoleDto.profileId,
        roleId: assignRoleDto.roleId,
        appScopeId: assignRoleDto.appScopeId,
      },
      relations: ['role', 'appScope'],
    });
    if (existingAssignment) {
      this.l.debug(
        `Role ${assignRoleDto.roleId} already assigned to profile ${assignRoleDto.profileId} in scope ${assignRoleDto.appScopeId}`
      );
      return existingAssignment;
    }

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
      targetId: assignRoleDto.targetId,
    });

    try {
      return await this.roleAssignmentsRepository.save(assignment);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const duplicateAssignment =
          await this.roleAssignmentsRepository.findOne({
            where: {
              profileId: assignRoleDto.profileId,
              roleId: assignRoleDto.roleId,
              appScopeId: assignRoleDto.appScopeId,
            },
            relations: ['role', 'appScope'],
          });
        if (duplicateAssignment) {
          this.l.debug(
            `Role assignment already exists for profile ${assignRoleDto.profileId} role ${assignRoleDto.roleId} scope ${assignRoleDto.appScopeId}`
          );
          return duplicateAssignment;
        }
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    return (
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }

  async unassignRole(assignmentId: string): Promise<void> {
    await this.roleAssignmentsRepository.delete(assignmentId);
  }

  async previewBulkRoleMutation(
    bulkRoleMutationDto: BulkRoleMutationDto
  ): Promise<BulkRoleMutationPreviewDto> {
    const role = await this.rolesRepository.findOne({
      where: { id: bulkRoleMutationDto.roleId },
      relations: ['appScope', 'permissions'],
    });

    const selectedProfileIds = Array.from(
      new Set((bulkRoleMutationDto.profileIds || []).filter(Boolean))
    );

    const existingAssignments =
      selectedProfileIds.length === 0
        ? []
        : await this.roleAssignmentsRepository.find({
            where: {
              roleId: bulkRoleMutationDto.roleId,
              appScopeId: bulkRoleMutationDto.appScopeId,
              profileId: In(selectedProfileIds),
              targetId: bulkRoleMutationDto.targetId ?? IsNull(),
            },
          });

    const assignedProfileIds = new Set(
      existingAssignments.map((assignment) => assignment.profileId)
    );

    const affectedProfileIds =
      bulkRoleMutationDto.operation === 'assign'
        ? selectedProfileIds.filter(
            (profileId) => !assignedProfileIds.has(profileId)
          )
        : selectedProfileIds.filter((profileId) =>
            assignedProfileIds.has(profileId)
          );

    const unchangedProfileIds =
      bulkRoleMutationDto.operation === 'assign'
        ? selectedProfileIds.filter((profileId) =>
            assignedProfileIds.has(profileId)
          )
        : selectedProfileIds.filter(
            (profileId) => !assignedProfileIds.has(profileId)
          );

    const profileImpacts = await Promise.all(
      affectedProfileIds.map(async (profileId) => {
        const currentAssignments = await this.getUserRoles(
          profileId,
          bulkRoleMutationDto.appScopeId
        );

        return this.buildProfileImpact(
          bulkRoleMutationDto,
          profileId,
          role,
          currentAssignments
        );
      })
    );

    return {
      operation: bulkRoleMutationDto.operation,
      roleId: bulkRoleMutationDto.roleId,
      roleName: role?.name || bulkRoleMutationDto.roleId,
      appScopeId: bulkRoleMutationDto.appScopeId,
      targetId: bulkRoleMutationDto.targetId,
      totalSelected: selectedProfileIds.length,
      affectedCount: affectedProfileIds.length,
      unchangedCount: unchangedProfileIds.length,
      affectedProfileIds,
      unchangedProfileIds,
      existingAssignmentIds: existingAssignments.map(
        (assignment) => assignment.id
      ),
      permissionChangeSummary: this.summarizePermissionChanges(profileImpacts),
      profileImpacts,
    };
  }

  async executeBulkRoleMutation(
    bulkRoleMutationDto: BulkRoleMutationDto
  ): Promise<BulkRoleMutationResultDto> {
    const preview = await this.previewBulkRoleMutation(bulkRoleMutationDto);

    if (bulkRoleMutationDto.operation === 'assign') {
      await Promise.all(
        preview.affectedProfileIds.map((profileId) =>
          this.assignRole({
            roleId: bulkRoleMutationDto.roleId,
            profileId,
            appScopeId: bulkRoleMutationDto.appScopeId,
            targetId: bulkRoleMutationDto.targetId,
          })
        )
      );
    } else {
      await Promise.all(
        preview.existingAssignmentIds.map((assignmentId) =>
          this.unassignRole(assignmentId)
        )
      );
    }

    return {
      ...preview,
      completedCount: preview.affectedCount,
    };
  }

  async findRoleAssignment(
    profileId: string,
    roleId: string,
    appScopeId: string,
    targetId?: string
  ): Promise<RoleAssignment | null> {
    const queryBuilder = this.roleAssignmentsRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.role', 'role')
      .leftJoinAndSelect('assignment.appScope', 'appScope')
      .where('assignment.profileId = :profileId', { profileId })
      .andWhere('assignment.roleId = :roleId', { roleId })
      .andWhere('assignment.appScopeId = :appScopeId', { appScopeId });

    if (targetId) {
      queryBuilder.andWhere('assignment.targetId = :targetId', { targetId });
    } else {
      queryBuilder.andWhere('assignment.targetId IS NULL');
    }

    return await queryBuilder.getOne();
  }

  async unassignRoleByTarget(
    profileId: string,
    roleId: string,
    appScopeId: string,
    targetId: string
  ): Promise<void> {
    await this.roleAssignmentsRepository.delete({
      profileId,
      roleId,
      appScopeId,
      targetId,
    });
  }

  async getUserRoles(
    profileId: string,
    appScopeIdOrName?: string
  ): Promise<RoleAssignment[]> {
    try {
      const queryBuilder = this.roleAssignmentsRepository
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.role', 'role')
        .leftJoinAndSelect('role.permissions', 'permissions')
        .leftJoinAndSelect('assignment.appScope', 'appScope')
        .where('assignment.profileId = :profileId', { profileId });

      if (appScopeIdOrName) {
        // Try to determine if it's a UUID or a name
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            appScopeIdOrName
          );

        if (isUuid) {
          queryBuilder.andWhere(
            '(appScope.id = :appScopeId OR appScope.name = :globalScope)',
            { appScopeId: appScopeIdOrName, globalScope: 'global' }
          );
        } else {
          queryBuilder.andWhere(
            '(appScope.name = :appScopeName OR appScope.name = :globalScope)',
            { appScopeName: appScopeIdOrName, globalScope: 'global' }
          );
        }
      }

      const roleAssignment = await queryBuilder.getMany();
      this.l.debug(
        `Found ${
          roleAssignment.length
        } role assignments for profile ${profileId} (appScopeIdOrName=${
          appScopeIdOrName ?? 'null'
        })`
      );
      return roleAssignment;
    } catch (error) {
      this.l.error(
        `getUserRoles failed for profileId=${profileId} appScopeIdOrName=${
          appScopeIdOrName ?? 'null'
        }`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }

  async checkPermission(
    profileId: string,
    permissionName: string,
    appScopeId: string,
    profileAppScope?: string,
    targetId?: string,
    checkGlobalFallback = false
  ): Promise<boolean> {
    this.l.log(
      `Checking permission: ${permissionName} for profile ${profileId} in appScope ${appScopeId}`
    );
    const assignments = await this.getUserRoles(profileId, appScopeId);

    if (assignments.length === 0) {
      this.l.warn(
        `No role assignments found for profile ${profileId} in appScope ${appScopeId}`
      );

      // Try global fallback if requested and we're not already checking global
      if (checkGlobalFallback) {
        const globalScope = await this.appScopesRepository.findOne({
          where: { name: 'global' },
        });

        if (globalScope && globalScope.id !== appScopeId) {
          this.l.debug(
            `Attempting global scope fallback for permission: ${permissionName}`
          );
          return this.checkPermission(
            profileId,
            permissionName,
            globalScope.id,
            'global',
            targetId,
            false // Don't recurse again
          );
        }
      }

      this.l.warn(
        `Permission denied: ${permissionName} for profile ${profileId} - No role assignments found`
      );
      return false;
    }

    for (const assignment of assignments) {
      // this.l.debug('Checking assignment:', assignment);

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
        // this.l.debug('Evaluating permission:', p.name, p.appScope);
        // this.l.debug('Against permissionName:', permissionName);
        // this.l.debug('Against targetId:', targetId);
        // this.l.debug('Against assignment.targetId:', assignment.targetId);
        // this.l.debug('Against appScopeId:', appScopeId);
        // this.l.debug('Against profileAppScope:', profileAppScope);

        const nameMatch =
          p.name === permissionName || p.action === permissionName;
        const assignmentTargetMatch =
          !targetId || !assignment.targetId || assignment.targetId === targetId;
        const permissionTargetMatch =
          !targetId || !p.targetId || p.targetId === targetId;
        const targetMatch = assignmentTargetMatch && permissionTargetMatch;

        if (!nameMatch) {
          this.l.debug(
            `Permission ${
              p.name || p.action
            } rejected - name/action does not match ${permissionName}`
          );
          continue;
        }

        if (!targetMatch) {
          // this.l.debug(
          //   `Permission ${p.name || p.action} rejected - targetId mismatch ` +
          //   `(expected: ${targetId}, assignmentTarget: ${assignment.targetId || 'none'
          //   }, permissionTarget: ${p.targetId || 'none'})`
          // );
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

  private buildProfileImpact(
    bulkRoleMutationDto: BulkRoleMutationDto,
    profileId: string,
    role: Role | null,
    currentAssignments: RoleAssignment[]
  ): BulkRoleMutationProfileImpactDto {
    const targetPermissions = role?.permissions || [];
    const currentPermissionKeys =
      this.collectPermissionKeys(currentAssignments);
    const retainedAssignments =
      bulkRoleMutationDto.operation === 'unassign'
        ? currentAssignments.filter(
            (assignment) => assignment.roleId !== bulkRoleMutationDto.roleId
          )
        : currentAssignments;
    const retainedPermissionKeys =
      bulkRoleMutationDto.operation === 'unassign'
        ? this.collectPermissionKeys(retainedAssignments)
        : currentPermissionKeys;

    return {
      profileId,
      permissionChanges: targetPermissions.map((permission) => {
        const permissionName =
          permission.name || `${permission.resource}.${permission.action}`;
        const permissionKey = this.getPermissionKey(permission);

        if (bulkRoleMutationDto.operation === 'assign') {
          const alreadyPresent = currentPermissionKeys.has(permissionKey);
          return {
            permissionName,
            resource: permission.resource,
            action: permission.action,
            status: alreadyPresent ? 'already-present' : 'added',
            reason: alreadyPresent
              ? 'Access already exists through another assigned role.'
              : 'Access will be newly granted by this role assignment.',
          };
        }

        const retained = retainedPermissionKeys.has(permissionKey);
        return {
          permissionName,
          resource: permission.resource,
          action: permission.action,
          status: retained ? 'retained' : 'removed',
          reason: retained
            ? 'Access will remain through another assigned role.'
            : 'Access will be removed when this role assignment is revoked.',
        };
      }),
    };
  }

  private summarizePermissionChanges(
    profileImpacts: BulkRoleMutationProfileImpactDto[]
  ): BulkRoleMutationPermissionChangeDto[] {
    const summary = new Map<string, BulkRoleMutationPermissionChangeDto>();

    for (const impact of profileImpacts) {
      for (const change of impact.permissionChanges) {
        const key = `${change.permissionName}:${change.status}`;
        const existing = summary.get(key);

        if (existing) {
          existing.affectedProfileCount =
            (existing.affectedProfileCount || 0) + 1;
          continue;
        }

        summary.set(key, {
          ...change,
          affectedProfileCount: 1,
        });
      }
    }

    return Array.from(summary.values());
  }

  private collectPermissionKeys(assignments: RoleAssignment[]): Set<string> {
    const keys = new Set<string>();

    for (const assignment of assignments) {
      const permissions = assignment.role?.permissions || [];
      for (const permission of permissions) {
        keys.add(this.getPermissionKey(permission));
      }
    }

    return keys;
  }

  private getPermissionKey(permission: Permission): string {
    return [
      permission.name || '',
      permission.resource || '',
      permission.action || '',
      permission.targetId || '',
    ].join('::');
  }
}
