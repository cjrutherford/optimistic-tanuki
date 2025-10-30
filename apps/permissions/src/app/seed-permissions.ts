import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Repository } from 'typeorm';
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

  const createdAppScopes: AppScope[] = [];
  for (const scopeData of seedData.app_scopes) {
    const dto: CreateAppScopeDto = {
      name: scopeData.name,
      description: scopeData.description,
      active: scopeData.active,
    };
    const appScope = appScopeRepo.create(dto);
    const savedAppScope = await appScopeRepo.save(appScope);
    createdAppScopes.push(savedAppScope);
  }

  const createdPermissions: Permission[] = [];
  for (const permissionData of seedData.permissions) {
    let existing = await permissionRepo.findOne({
      where: { name: permissionData.name },
      relations: ['appScopes'],
    });
    const permissionAppScopes = permissionData.appScope
      ? createdAppScopes.filter((s) => s.name === permissionData.appScope)
      : [];

    if (existing) {
      if (permissionAppScopes.length > 0) {
        existing.appScopes = [
          ...new Set([...(existing.appScopes || []), ...permissionAppScopes]),
        ];
        await permissionRepo.save(existing);
      }
      continue;
    }

    const permissionDto: CreatePermissionDto = {
      name: permissionData.name,
      description: permissionData.description,
      resource: permissionData.resource || '',
      action: permissionData.action || '',
      targetId: permissionData.targetId,
    };

    const permission = permissionRepo.create(permissionDto);
    permission.appScopes = permissionAppScopes;
    const savedPermission = await permissionRepo.save(permission);
    createdPermissions.push(savedPermission);
  }

  const createdRoles: Role[] = [];
  for (const roleData of seedData.roles) {
    const roleDto: CreateRoleDto = {
      name: roleData.name,
      description: roleData.description,
      appScopeId:
        createdAppScopes.find((s) => s.name === roleData.appScope)?.id || '',
    };

    const role = roleRepo.create(roleDto);
    const savedRole = await roleRepo.save(role);
    createdRoles.push(savedRole);
  }

  for (const rpData of seedData.role_permissions) {
    const role = createdRoles.find((r) => r.name === rpData.role);
    const permission = createdPermissions.find(
      (p) => p.name === rpData.permission
    );
    const appScope = createdAppScopes.find(
      (a) => a.name === rpData.permissionAppScope
    );
    if (role && permission && appScope) {
      // Ensure appScopes is set according to Permission entity schema
      permission.appScopes = [appScope, ...(permission.appScopes || [])];
      await permissionRepo.save(permission);

      const roleAssignment = roleAssignmentRepo.create({
        profileId: 'system-seed',
        appScope: appScope,
        role: role,
      });
      await roleAssignmentRepo.save(roleAssignment);
    }
  }

  console.log('Seeding completed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
