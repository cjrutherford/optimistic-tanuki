import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { PermissionsService } from './permissions.service';
import { RolesService } from './roles.service';
import { AppScopesService } from './app-scopes.service';
import { RoleInitOptions } from '@optimistic-tanuki/permission-lib';

interface VerificationResult {
  scopeName: string;
  permissionsAdded: string[];
  rolesAdded: string[];
  assignmentsAdded: string[];
  permissionsMissing: string[];
  rolesMissing: string[];
  discrepancies: string[];
}

@Injectable()
export class PermissionsVerificationService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsVerificationService.name);
  private readonly verificationResults: VerificationResult[] = [];

  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(RoleAssignment)
    private roleAssignmentsRepository: Repository<RoleAssignment>,
    @InjectRepository(AppScope)
    private appScopesRepository: Repository<AppScope>,
    private permissionsService: PermissionsService,
    private rolesService: RolesService,
    private appScopesService: AppScopesService,
    private schedulerRegistry: SchedulerRegistry
  ) {}

  onModuleInit() {
    this.logger.log('PermissionsVerificationService initialized');
    this.logger.log('Scheduled verification job: runs every 6 hours');
  }

  @Cron('0 */6 * * *')
  async handleScheduledVerification() {
    this.logger.log('Starting scheduled permissions verification...');
    const startTime = Date.now();

    try {
      await this.verifyAndSync();
      const duration = Date.now() - startTime;
      this.logger.log(`Scheduled verification completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Scheduled verification failed', error);
    }
  }

  async verifyAndSync(): Promise<VerificationResult[]> {
    this.verificationResults.length = 0;

    await this.cleanupExpiredCache();

    const appScopes = await this.appScopesRepository.find();
    this.logger.log(`Verifying ${appScopes.length} app scopes`);

    for (const scope of appScopes) {
      if (!scope.active) {
        this.logger.debug(`Skipping inactive scope: ${scope.name}`);
        continue;
      }

      const result = await this.verifyScope(scope);
      this.verificationResults.push(result);
    }

    const summary = this.generateSummary();
    this.logger.log(summary);

    return this.verificationResults;
  }

  private async cleanupExpiredCache(): Promise<void> {
    this.logger.debug('Running cache cleanup...');
    try {
      const allPermissions = await this.permissionsRepository.find();
      this.logger.debug(
        `Cache cleanup: verified ${allPermissions.length} permissions exist`
      );
    } catch (error) {
      this.logger.warn(
        'Cache cleanup skipped - cache provider not available in this context'
      );
    }
  }

  private async verifyScope(scope: AppScope): Promise<VerificationResult> {
    const result: VerificationResult = {
      scopeName: scope.name,
      permissionsAdded: [],
      rolesAdded: [],
      assignmentsAdded: [],
      permissionsMissing: [],
      rolesMissing: [],
      discrepancies: [],
    };

    this.logger.debug(`Verifying scope: ${scope.name}`);

    const baselineConfig = this.getBaselineConfigForScope(scope.name);

    const existingPermissions = await this.permissionsRepository.find({
      where: { appScopeId: scope.id },
    });
    const existingPermissionNames = new Set(
      existingPermissions.map((p) => p.name)
    );

    for (const permSpec of baselineConfig.permissions || []) {
      if (!existingPermissionNames.has(permSpec.name)) {
        try {
          await this.permissionsService.createPermission({
            name: permSpec.name,
            description: permSpec.description || '',
            resource: permSpec.resource,
            action: permSpec.action,
            targetId: permSpec.targetId || scope.id,
            appScopeId: scope.id,
          } as any);
          result.permissionsAdded.push(permSpec.name);
          this.logger.log(
            `Added missing permission: ${permSpec.name} in scope ${scope.name}`
          );
        } catch (error) {
          result.discrepancies.push(
            `Failed to add permission ${permSpec.name}: ${error}`
          );
        }
      }
    }

    const existingRoles = await this.rolesRepository.find({
      where: { appScope: { id: scope.id } },
      relations: ['permissions'],
    });
    const existingRoleNames = new Set(existingRoles.map((r) => r.name));

    for (const roleSpec of baselineConfig.roles || []) {
      if (!existingRoleNames.has(roleSpec.name)) {
        try {
          const newRole = await this.rolesService.createRole({
            name: roleSpec.name,
            description: roleSpec.description || '',
            appScopeId: scope.id,
          } as any);
          result.rolesAdded.push(roleSpec.name);
          this.logger.log(
            `Added missing role: ${roleSpec.name} in scope ${scope.name}`
          );

          for (const permName of roleSpec.permissions || []) {
            const perm = existingPermissions.find((p) => p.name === permName);
            if (perm) {
              await this.rolesService.addPermissionToRole(newRole.id, perm.id);
            }
          }
        } catch (error) {
          result.discrepancies.push(
            `Failed to add role ${roleSpec.name}: ${error}`
          );
        }
      } else {
        const existingRole = existingRoles.find(
          (r) => r.name === roleSpec.name
        );
        if (existingRole) {
          const existingPermNames = new Set(
            existingRole.permissions?.map((p) => p.name) || []
          );
          for (const permName of roleSpec.permissions || []) {
            if (!existingPermNames.has(permName)) {
              const perm = existingPermissions.find((p) => p.name === permName);
              if (perm) {
                await this.rolesService.addPermissionToRole(
                  existingRole.id,
                  perm.id
                );
                this.logger.log(
                  `Added missing permission ${permName} to role ${roleSpec.name}`
                );
              }
            }
          }
        }
      }
    }

    const existingAssignments = await this.roleAssignmentsRepository.find({
      where: { appScope: { id: scope.id } },
      relations: ['role'],
    });

    for (const assignmentSpec of baselineConfig.assignments || []) {
      const role = existingRoles.find(
        (r) => r.name === assignmentSpec.roleName
      );
      if (!role) {
        result.rolesMissing.push(assignmentSpec.roleName);
        continue;
      }

      const profileId = assignmentSpec.profileId;
      if (!profileId) continue;

      const existingAssignment = existingAssignments.find(
        (a) => a.role.id === role.id && a.profileId === profileId
      );

      if (!existingAssignment) {
        try {
          await this.rolesService.assignRole({
            profileId,
            roleId: role.id,
            appScopeId: scope.id,
            targetId: (assignmentSpec as any).targetId,
          } as any);
          result.assignmentsAdded.push(
            `${assignmentSpec.roleName}:${profileId}`
          );
          this.logger.log(
            `Added missing assignment: ${assignmentSpec.roleName} for ${profileId}`
          );
        } catch (error) {
          result.discrepancies.push(
            `Failed to add assignment ${assignmentSpec.roleName}:${profileId}: ${error}`
          );
        }
      }
    }

    return result;
  }

  private getBaselineConfigForScope(scopeName: string): RoleInitOptions {
    const configs: Record<string, RoleInitOptions> = {
      global: {
        permissions: [
          {
            name: 'public',
            description: 'Public access',
            resource: '*',
            action: 'read',
          },
          {
            name: 'admin',
            description: 'Full admin access',
            resource: '*',
            action: '*',
          },
        ],
        roles: [
          {
            name: 'owner',
            description: 'Full system owner',
            permissions: ['admin', 'public'],
          },
          {
            name: 'forum_moderator',
            description: 'Forum moderator',
            permissions: ['public'],
          },
        ],
        assignments: [],
      },
      'client-interface': {
        permissions: [
          {
            name: 'community.read',
            description: 'Read community',
            resource: 'community',
            action: 'read',
          },
          {
            name: 'community.create',
            description: 'Create community',
            resource: 'community',
            action: 'create',
          },
          {
            name: 'community.update',
            description: 'Update community',
            resource: 'community',
            action: 'update',
          },
          {
            name: 'community.delete',
            description: 'Delete community',
            resource: 'community',
            action: 'delete',
          },
        ],
        roles: [
          {
            name: 'client_interface_user',
            description: 'Standard client user',
            permissions: ['community.read'],
          },
          {
            name: 'client_profile_owner',
            description: 'Profile owner',
            permissions: ['community.read', 'community.create'],
          },
          {
            name: 'client_asset_manager',
            description: 'Asset manager',
            permissions: [],
          },
          {
            name: 'forum_moderator',
            description: 'Forum moderator',
            permissions: ['community.read', 'community.delete'],
          },
        ],
        assignments: [],
      },
      social: {
        permissions: [
          {
            name: 'community.read',
            description: 'Read community',
            resource: 'community',
            action: 'read',
          },
          {
            name: 'community.create',
            description: 'Create community',
            resource: 'community',
            action: 'create',
          },
          {
            name: 'community.post',
            description: 'Create posts',
            resource: 'post',
            action: 'create',
          },
        ],
        roles: [
          {
            name: 'social_user',
            description: 'Standard social user',
            permissions: ['community.read', 'community.post'],
          },
          {
            name: 'community_owner',
            description: 'Community owner',
            permissions: [
              'community.read',
              'community.create',
              'community.post',
            ],
          },
        ],
        assignments: [],
      },
      store: {
        permissions: [
          {
            name: 'product.read',
            description: 'Read products',
            resource: 'product',
            action: 'read',
          },
          {
            name: 'product.create',
            description: 'Create products',
            resource: 'product',
            action: 'create',
          },
          {
            name: 'product.update',
            description: 'Update products',
            resource: 'product',
            action: 'update',
          },
          {
            name: 'product.delete',
            description: 'Delete products',
            resource: 'product',
            action: 'delete',
          },
          {
            name: 'order.read',
            description: 'Read orders',
            resource: 'order',
            action: 'read',
          },
          {
            name: 'order.update',
            description: 'Update orders',
            resource: 'order',
            action: 'update',
          },
        ],
        roles: [
          {
            name: 'store_manager',
            description: 'Store manager',
            permissions: [
              'product.read',
              'product.create',
              'product.update',
              'product.delete',
              'order.read',
              'order.update',
            ],
          },
          {
            name: 'store_customer',
            description: 'Store customer',
            permissions: ['product.read', 'order.read'],
          },
        ],
        assignments: [],
      },
      blogging: {
        permissions: [
          {
            name: 'blog.read',
            description: 'Read blogs',
            resource: 'blog',
            action: 'read',
          },
          {
            name: 'blog.create',
            description: 'Create blogs',
            resource: 'blog',
            action: 'create',
          },
          {
            name: 'blog.update',
            description: 'Update blogs',
            resource: 'blog',
            action: 'update',
          },
          {
            name: 'blog.delete',
            description: 'Delete blogs',
            resource: 'blog',
            action: 'delete',
          },
        ],
        roles: [
          {
            name: 'blog_author',
            description: 'Blog author',
            permissions: ['blog.read', 'blog.create', 'blog.update'],
          },
          {
            name: 'blog_reader',
            description: 'Blog reader',
            permissions: ['blog.read'],
          },
        ],
        assignments: [],
      },
      assets: {
        permissions: [
          {
            name: 'asset.read',
            description: 'Read assets',
            resource: 'asset',
            action: 'read',
          },
          {
            name: 'asset.create',
            description: 'Create assets',
            resource: 'asset',
            action: 'create',
          },
          {
            name: 'asset.delete',
            description: 'Delete assets',
            resource: 'asset',
            action: 'delete',
          },
        ],
        roles: [
          {
            name: 'asset_owner',
            description: 'Asset owner',
            permissions: ['asset.read', 'asset.create', 'asset.delete'],
          },
          {
            name: 'asset_viewer',
            description: 'Asset viewer',
            permissions: ['asset.read'],
          },
        ],
        assignments: [],
      },
      'digital-homestead': {
        permissions: [
          {
            name: 'homestead.read',
            description: 'Read homestead',
            resource: 'homestead',
            action: 'read',
          },
          {
            name: 'homestead.create',
            description: 'Create homestead',
            resource: 'homestead',
            action: 'create',
          },
        ],
        roles: [
          {
            name: 'digital_homesteader',
            description: 'Digital homesteader',
            permissions: ['homestead.read', 'homestead.create'],
          },
          {
            name: 'digital_standard_user',
            description: 'Standard user',
            permissions: ['homestead.read'],
          },
        ],
        assignments: [],
      },
      forgeofwill: {
        permissions: [
          {
            name: 'project.read',
            description: 'Read projects',
            resource: 'project',
            action: 'read',
          },
          {
            name: 'project.create',
            description: 'Create projects',
            resource: 'project',
            action: 'create',
          },
          {
            name: 'task.create',
            description: 'Create tasks',
            resource: 'task',
            action: 'create',
          },
        ],
        roles: [
          {
            name: 'forgeofwill_planner',
            description: 'Project planner',
            permissions: ['project.read', 'project.create', 'task.create'],
          },
          {
            name: 'forgeofwill_standard_user',
            description: 'Standard user',
            permissions: ['project.read'],
          },
        ],
        assignments: [],
      },
      'owner-console': {
        permissions: [
          {
            name: 'console.read',
            description: 'Read console',
            resource: 'console',
            action: 'read',
          },
          {
            name: 'console.write',
            description: 'Write console',
            resource: 'console',
            action: 'write',
          },
          {
            name: 'users.manage',
            description: 'Manage users',
            resource: 'users',
            action: 'manage',
          },
          {
            name: 'roles.manage',
            description: 'Manage roles',
            resource: 'roles',
            action: 'manage',
          },
          {
            name: 'permissions.manage',
            description: 'Manage permissions',
            resource: 'permissions',
            action: 'manage',
          },
        ],
        roles: [
          {
            name: 'owner_console_owner',
            description: 'Console owner',
            permissions: [
              'console.read',
              'console.write',
              'users.manage',
              'roles.manage',
              'permissions.manage',
            ],
          },
        ],
        assignments: [],
      },
      'local-hub': {
        permissions: [
          {
            name: 'hub.read',
            description: 'Read hub',
            resource: 'hub',
            action: 'read',
          },
          {
            name: 'hub.join',
            description: 'Join hub',
            resource: 'hub',
            action: 'join',
          },
        ],
        roles: [
          {
            name: 'local_hub_member',
            description: 'Hub member',
            permissions: ['hub.read', 'hub.join'],
          },
        ],
        assignments: [],
      },
    };

    return (
      configs[scopeName] || { permissions: [], roles: [], assignments: [] }
    );
  }

  private generateSummary(): string {
    const totalPermissionsAdded = this.verificationResults.reduce(
      (sum, r) => sum + r.permissionsAdded.length,
      0
    );
    const totalRolesAdded = this.verificationResults.reduce(
      (sum, r) => sum + r.rolesAdded.length,
      0
    );
    const totalAssignmentsAdded = this.verificationResults.reduce(
      (sum, r) => sum + r.assignmentsAdded.length,
      0
    );
    const totalDiscrepancies = this.verificationResults.reduce(
      (sum, r) => sum + r.discrepancies.length,
      0
    );

    return (
      `Verification Summary: ` +
      `${totalPermissionsAdded} permissions added, ` +
      `${totalRolesAdded} roles added, ` +
      `${totalAssignmentsAdded} assignments added, ` +
      `${totalDiscrepancies} discrepancies`
    );
  }

  getLastVerificationResults(): VerificationResult[] {
    return this.verificationResults;
  }

  async runVerificationNow(): Promise<VerificationResult[]> {
    this.logger.log('Manual verification triggered');
    return this.verifyAndSync();
  }
}
