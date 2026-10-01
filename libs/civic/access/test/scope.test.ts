import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP_SCOPE,
  EXISTING_ROLES,
  PERMISSIONS,
  ROLE_DENIALS,
  ROLE_PERMISSIONS,
  ROLES,
  effectivePermissions,
  scopeSeed,
} from '../src/scope.js';

interface PermissionsSeed {
  app_scopes: { name: string }[];
  roles: { name: string; appScope?: string }[];
}

const permissionsSeed = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../../apps/permissions/src/assets/default-permissions.json'
    ),
    'utf8'
  )
) as PermissionsSeed;

describe('access model', () => {
  it('grants and denies only permissions that exist', () => {
    const known = new Set(PERMISSIONS.map((permission) => permission.name));
    for (const role of ROLES) {
      for (const granted of ROLE_PERMISSIONS[role])
        expect(known.has(granted)).toBeTruthy();
      for (const denied of ROLE_DENIALS[role] ?? [])
        expect(known.has(denied)).toBeTruthy();
    }
  });

  it('names every permission as resource.action, like the permissions seed', () => {
    for (const permission of PERMISSIONS) {
      expect(permission.name).toBe(
        `${permission.resource}.${permission.action}`
      );
      expect(permission.name).toMatch(/^[a-z-]+\.[a-z-]+$/u);
      expect(permission.description.trim().length > 10).toBeTruthy();
    }
    expect(new Set(PERMISSIONS.map((p) => p.name)).size).toBe(
      PERMISSIONS.length
    );
  });

  it('names every role in snake case under the local_hub_ prefix', () => {
    for (const role of ROLES) expect(role).toMatch(/^local_hub_[a-z_]+$/u);
  });

  it('lets members corroborate but never a verified official, even as a member', () => {
    // An official corroborating a meeting they ran is not a second witness.
    expect(
      effectivePermissions(['local_hub_member']).has('corroboration.create')
    ).toBe(true);
    expect(
      effectivePermissions(['local_hub_verified_official']).has(
        'corroboration.create'
      )
    ).toBe(false);
    const official = effectivePermissions([
      'local_hub_member',
      'local_hub_verified_official',
    ]);
    expect(official.has('corroboration.create')).toBe(false);
    expect(official.has('official-record.submit')).toBe(true);
    expect(official.has('contribution.create')).toBe(true);
  });

  it("gives no role the power to moderate another person's contribution", () => {
    // Review is mechanical; an admin may read decisions, never override them.
    for (const role of ROLES) {
      for (const granted of ROLE_PERMISSIONS[role]) {
        expect(/contribution\.(approve|reject|edit)/u.test(granted)).toBe(
          false
        );
      }
    }
  });

  it('extends roles the permissions seed declares and adds only the new one', () => {
    expect(permissionsSeed.app_scopes.map((scope) => scope.name)).toContain(
      APP_SCOPE
    );
    const declared = new Set(
      permissionsSeed.roles
        .filter((role) => role.appScope === APP_SCOPE)
        .map((role) => role.name)
    );
    for (const role of ROLES) {
      expect(declared.has(role)).toBe(EXISTING_ROLES.includes(role));
    }
  });

  it('produces a seed carrying the scope, its permissions, and its roles', () => {
    const seed = scopeSeed();
    expect(seed.appScope.name).toBe(APP_SCOPE);
    expect(seed.roles.map((role) => role.name)).toStrictEqual([...ROLES]);
    expect(
      seed.roles.filter((role) => role.existing).map((role) => role.name)
    ).toStrictEqual([...EXISTING_ROLES]);
    expect(seed.permissions.length).toBe(PERMISSIONS.length);
  });
});
