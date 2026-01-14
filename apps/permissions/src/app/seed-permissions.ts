import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Repository, IsNull } from 'typeorm';
import seedDataRaw from '../assets/default-permissions.json';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppScope } from '../app-scopes/entities/app-scope.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleAssignment } from '../role-assignments/entities/role-assignment.entity';
import {
  CreatePermissionDto,
  CreateRoleDto,
  CreateAppScopeDto,
} from '@optimistic-tanuki/models';

type SeedData = {
  app_scopes: { name: string; description: string; active: boolean }[];
  permissions: {
    name: string;
    description: string;
    active: boolean;
    resource?: string;
    action?: string;
    targetId?: string;
    appScope?: string;
  }[];
  roles: {
    name: string;
    description: string;
    appScope: string;
  }[];
  role_permissions: {
    role: string;
    permission: string;
    permissionAppScope: string;
  }[];
};

const seedData: SeedData = seedDataRaw as unknown as SeedData;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const appScopeRepo = app.get<Repository<AppScope>>(
      getRepositoryToken(AppScope)
    );
    const permissionRepo = app.get<Repository<Permission>>(
      getRepositoryToken(Permission)
    );
    const roleRepo = app.get<Repository<Role>>(getRepositoryToken(Role));
    const roleAssignmentRepo = app.get<Repository<RoleAssignment>>(
      getRepositoryToken(RoleAssignment)
    );

    console.log('Starting seed process...');

    // Seed App Scopes
    const createdAppScopes: AppScope[] = [];
    console.log(`Processing ${seedData.app_scopes.length} app scopes...`);

    for (const scopeData of seedData.app_scopes) {
      try {
        let existing = await appScopeRepo.findOne({
          where: { name: scopeData.name },
        });

        if (existing) {
          console.log(
            `App scope "${scopeData.name}" already exists, updating...`
          );
          existing.description = scopeData.description;
          existing.active = scopeData.active;
          const updated = await appScopeRepo.save(existing);
          createdAppScopes.push(updated);
        } else {
          console.log(`Creating app scope "${scopeData.name}"...`);
          const dto: CreateAppScopeDto = {
            name: scopeData.name,
            description: scopeData.description,
            active: scopeData.active,
          };
          const appScope = appScopeRepo.create(dto);
          const savedAppScope = await appScopeRepo.save(appScope);
          createdAppScopes.push(savedAppScope);
          console.log(`App scope "${scopeData.name}" created successfully.`);
        }
      } catch (error) {
        console.error(`Error processing app scope "${scopeData.name}":`, error);
        throw new Error(
          `Failed to seed app scope "${scopeData.name}": ${error.message}`
        );
      }
    }

    // Seed Permissions
    const createdPermissions: Permission[] = [];
    console.log(`Processing ${seedData.permissions.length} permissions...`);

    for (const permissionData of seedData.permissions) {
      try {
        const permissionAppScope = permissionData.appScope
          ? createdAppScopes.find((s) => s.name === permissionData.appScope)
          : null;

        let existing = await permissionRepo.findOne({
          where: {
            name: permissionData.name,
            appScopeId: permissionAppScope ? permissionAppScope.id : IsNull(),
          },
        });

        if (existing) {
          console.log(
            `Permission "${permissionData.name}" already exists, updating...`
          );
          existing.description = permissionData.description;
          existing.resource = permissionData.resource || '';
          existing.action = permissionData.action || '';
          existing.targetId = permissionData.targetId;
          if (permissionAppScope) {
            existing.appScope = permissionAppScope;
          }
          await permissionRepo.save(existing);
          // Ensure the appScope object (with its name) is available for later finding
          if (permissionAppScope) existing.appScope = permissionAppScope;
          createdPermissions.push(existing);
        } else {
          console.log(`Creating permission "${permissionData.name}"...`);
          const permissionDto: CreatePermissionDto = {
            name: permissionData.name,
            description: permissionData.description,
            resource: permissionData.resource || '',
            action: permissionData.action || '',
            targetId: permissionData.targetId,
          };

          const permission = permissionRepo.create(permissionDto);
          permission.appScope = permissionAppScope;
          const savedPermission = await permissionRepo.save(permission);
          // Ensure the appScope object (with its name) is available for later finding
          if (permissionAppScope) savedPermission.appScope = permissionAppScope;
          createdPermissions.push(savedPermission);
          console.log(
            `Permission "${permissionData.name}" created successfully.`
          );
        }
      } catch (error) {
        console.error(
          `Error processing permission "${permissionData.name}":`,
          error
        );
        throw new Error(
          `Failed to seed permission "${permissionData.name}": ${error.message}`
        );
      }
    }

    // Seed Roles
    const createdRoles: Role[] = [];
    console.log(`Processing ${seedData.roles.length} roles...`);

    for (const roleData of seedData.roles) {
      try {
        let existing = await roleRepo.findOne({
          where: { name: roleData.name },
        });

        const appScope = createdAppScopes.find(
          (s) => s.name === roleData.appScope
        );

        if (!appScope) {
          console.warn(
            `App scope "${roleData.appScope}" not found for role "${roleData.name}", skipping...`
          );
          continue;
        }

        if (existing) {
          console.log(`Role "${roleData.name}" already exists, updating...`);
          existing.description = roleData.description;
          existing.appScope = appScope;
          const updated = await roleRepo.save(existing);
          createdRoles.push(updated);
        } else {
          console.log(`Creating role "${roleData.name}"...`);
          const role = roleRepo.create({
            name: roleData.name,
            description: roleData.description,
          });
          role.appScope = appScope;
          const savedRole = await roleRepo.save(role);
          createdRoles.push(savedRole);
          console.log(`Role "${roleData.name}" created successfully.`);
        }
      } catch (error) {
        console.error(`Error processing role "${roleData.name}":`, error);
        throw new Error(
          `Failed to seed role "${roleData.name}": ${error.message}`
        );
      }
    }

    // Seed Role Permissions (associate permissions with roles)
    console.log(
      `Processing ${seedData.role_permissions.length} role-permission associations...`
    );

    for (const rpData of seedData.role_permissions) {
      try {
        const role = createdRoles.find((r) => r.name === rpData.role);
        // Robust finding of permission by name and app scope name
        const permission = createdPermissions.find((p) => {
          const nameMatches = p.name === rpData.permission;
          // Check both p.appScope.name and permissionAppScope match (p.appScope might be joined or just an object we set)
          const pScopeName = p.appScope?.name;
          const scopeMatches =
            pScopeName === rpData.permissionAppScope ||
            (!pScopeName && !rpData.permissionAppScope);
          return nameMatches && scopeMatches;
        });

        if (!role) {
          console.warn(
            `Role "${rpData.role}" not found, skipping permission association for "${rpData.permission}" in "${rpData.permissionAppScope}"...`
          );
          continue;
        }
        if (!permission) {
          console.warn(
            `Permission "${rpData.permission}" in app scope "${rpData.permissionAppScope}" not found, skipping association with role "${rpData.role}"...`
          );
          continue;
        }

        // Load role with permissions to check if permission is already associated
        const roleWithPermissions = await roleRepo.findOne({
          where: { id: role.id },
          relations: ['permissions'],
        });

        if (!roleWithPermissions) {
          console.warn(
            `Role "${rpData.role}" not found when loading with permissions, skipping...`
          );
          continue;
        }

        // Check if permission is already associated with role
        const alreadyHasPermission = roleWithPermissions.permissions?.some(
          (p) => p.id === permission.id
        );

        if (alreadyHasPermission) {
          // Only log for important roles to reduce noise, or if it was just added
          if (rpData.role === 'client_interface_user') {
            console.log(
              `Permission "${rpData.permission}" already associated with role "${rpData.role}", skipping...`
            );
          }
          continue;
        }

        // Add permission to role
        console.log(
          `Associating permission "${rpData.permission}" (${rpData.permissionAppScope}) with role "${rpData.role}"...`
        );
        if (!roleWithPermissions.permissions) {
          roleWithPermissions.permissions = [];
        }
        roleWithPermissions.permissions.push(permission);
        await roleRepo.save(roleWithPermissions);
        console.log(
          `Permission "${rpData.permission}" associated with role "${rpData.role}" successfully.`
        );
      } catch (error) {
        console.error(
          `Error processing role-permission association for role "${rpData.role}" and permission "${rpData.permission}":`,
          error
        );
        throw new Error(
          `Failed to seed role-permission association for role "${rpData.role}": ${error.message}`
        );
      }
    }

    console.log('Seeding completed successfully.');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Critical error during seeding:', error);
    console.error('Stack trace:', error.stack);
    await app.close();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error during seeding:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
