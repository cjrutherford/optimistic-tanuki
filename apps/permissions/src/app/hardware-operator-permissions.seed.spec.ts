export {};

const seedData = require('../assets/default-permissions.json');

interface RolePermission {
  role: string;
  permission: string;
  permissionAppScope: string;
}

const OWNER_ROLES = [
  'owner_console_owner',
  'owner',
  'global_admin',
  'system_admin',
];

describe('hardware.operate in the owner-console scope', () => {
  it('is declared once, in owner-console', () => {
    const matches = seedData.permissions.filter(
      (p: { name: string; appScope: string }) => p.name === 'hardware.operate'
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].appScope).toBe('owner-console');
  });

  it.each(OWNER_ROLES)('is granted to %s', (role) => {
    const grants: RolePermission[] = seedData.role_permissions.filter(
      (g: RolePermission) =>
        g.permission === 'hardware.operate' && g.role === role
    );
    expect(grants).toEqual([
      {
        role,
        permission: 'hardware.operate',
        permissionAppScope: 'owner-console',
      },
    ]);
  });
});
