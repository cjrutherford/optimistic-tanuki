import * as fs from 'fs';
import * as path from 'path';
import { SeedData, validateSeedData } from './seed-permissions';

const seedData = require('../assets/default-permissions.json') as SeedData;

describe('permissions seed integrity', () => {
  it('grants Forge planners the exact delete permissions exposed by Forge project controls', () => {
    const plannerDeletePermissions = seedData.role_permissions
      .filter(
        (association) =>
          association.role === 'forgeofwill_planner' &&
          association.permission.endsWith('.delete')
      )
      .map((association) => association.permission)
      .sort();

    expect(plannerDeletePermissions).toEqual([
      'project-planning.change.delete',
      'project-planning.journal.delete',
      'project-planning.project.delete',
      'project-planning.risk.delete',
      'project-planning.task-note.delete',
      'project-planning.task-time-entry.delete',
      'project-planning.task.delete',
      'project-planning.timer.delete',
    ]);
  });

  it('resolves every role-permission association to a declared role and permission scope', () => {
    const roles = new Set(
      seedData.roles.map((role: { name: string }) => role.name)
    );
    const permissions = new Set(
      seedData.permissions.map(
        (permission: { name: string; appScope?: string }) =>
          `${permission.name}\u0000${permission.appScope ?? ''}`
      )
    );
    const unresolved = seedData.role_permissions.filter(
      (association: {
        role: string;
        permission: string;
        permissionAppScope: string;
      }) =>
        !roles.has(association.role) ||
        !permissions.has(
          `${association.permission}\u0000${
            association.permissionAppScope ?? ''
          }`
        )
    );

    expect(unresolved).toEqual([]);
  });

  it('validates seed references before creating the application context', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'seed-permissions.ts'),
      'utf8'
    );

    expect(source.indexOf('validateSeedData(seedData)')).toBeGreaterThan(-1);
    expect(source.indexOf('validateSeedData(seedData)')).toBeLessThan(
      source.indexOf('NestFactory.createApplicationContext')
    );
  });

  it('rejects an association whose role is not declared', () => {
    const invalidSeedData: SeedData = {
      ...seedData,
      role_permissions: [
        ...seedData.role_permissions,
        {
          role: 'missing-role',
          permission: seedData.permissions[0].name,
          permissionAppScope: seedData.permissions[0].appScope ?? '',
        },
      ],
    };

    expect(() => validateSeedData(invalidSeedData)).toThrow(
      'role "missing-role" is not declared'
    );
  });

  it('rejects an association whose permission is not declared in the referenced scope', () => {
    const invalidSeedData: SeedData = {
      ...seedData,
      role_permissions: [
        ...seedData.role_permissions,
        {
          role: seedData.roles[0].name,
          permission: 'missing.permission',
          permissionAppScope: 'global',
        },
      ],
    };

    expect(() => validateSeedData(invalidSeedData)).toThrow(
      'permission "missing.permission" is not declared in app scope "global"'
    );
  });
});
