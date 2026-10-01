import {
  APP_SCOPE,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  scopeSeed,
} from '../src/scope.js';

describe('access model', () => {
  it('grants only permissions that exist', () => {
    const known = new Set(PERMISSIONS.map((permission) => permission.name));
    for (const role of ROLES) {
      for (const granted of ROLE_PERMISSIONS[role])
        expect(known.has(granted)).toBeTruthy();
    }
  });

  it('names every permission as resource:action', () => {
    for (const permission of PERMISSIONS) {
      expect(permission.name).toBe(
        `${permission.resource}:${permission.action}`
      );
      expect(permission.description.trim().length > 10).toBeTruthy();
    }
    expect(new Set(PERMISSIONS.map((p) => p.name)).size).toBe(
      PERMISSIONS.length
    );
  });

  it('keeps corroboration out of the reach of readers and officials', () => {
    // An official corroborating a meeting they ran is not a second witness.
    expect(
      ROLE_PERMISSIONS['verified-official'].includes('corroboration:create')
    ).toBe(false);
    expect(ROLE_PERMISSIONS.reader.includes('corroboration:create')).toBe(
      false
    );
    expect(ROLE_PERMISSIONS.contributor.includes('corroboration:create')).toBe(
      true
    );
  });

  it("gives no role the power to moderate another person's contribution", () => {
    // Review is mechanical; an operator may read decisions, never override them.
    for (const role of ROLES) {
      for (const granted of ROLE_PERMISSIONS[role]) {
        expect(/contribution:(approve|reject|edit)/u.test(granted)).toBe(false);
      }
    }
  });

  it('produces a seed carrying the scope, its permissions, and its roles', () => {
    const seed = scopeSeed();
    expect(seed.appScope.name).toBe(APP_SCOPE);
    expect(seed.roles.length).toBe(ROLES.length);
    expect(seed.roles.map((role) => role.name)).toStrictEqual([...ROLES]);
    expect(seed.permissions.length).toBe(PERMISSIONS.length);
  });
});
