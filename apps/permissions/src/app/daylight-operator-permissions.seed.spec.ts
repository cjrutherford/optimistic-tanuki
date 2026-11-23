export {};

const seedData = require('../assets/default-permissions.json');

interface RolePermission {
  role: string;
  permission: string;
  permissionAppScope: string;
}

const OPERATOR_PERMISSIONS = [
  'town.configure',
  'density.read',
  'takedown.manage',
  'official.verify',
  'community.maintain',
  'sources.read',
  'sources.manage',
];
const OWNER_ROLES = [
  'owner_console_owner',
  'owner',
  'global_admin',
  'system_admin',
];

describe('Daylight operator permissions in the owner-console scope', () => {
  it.each(OPERATOR_PERMISSIONS)('declares %s in owner-console', (name) => {
    const matches = seedData.permissions.filter(
      (p: { name: string; appScope: string }) =>
        p.name === name && p.appScope === 'owner-console'
    );
    expect(matches).toHaveLength(1);
  });

  it.each(OPERATOR_PERMISSIONS)(
    'grants %s to every owner role, and keeps the local-hub admin grant',
    (name) => {
      const grants: RolePermission[] = seedData.role_permissions.filter(
        (g: RolePermission) => g.permission === name
      );
      for (const role of OWNER_ROLES) {
        expect(
          grants.some(
            (g) => g.role === role && g.permissionAppScope === 'owner-console'
          )
        ).toBe(true);
      }
      expect(
        grants.some(
          (g) =>
            g.role === 'local_hub_admin' && g.permissionAppScope === 'local-hub'
        )
      ).toBe(true);
    }
  );
});
