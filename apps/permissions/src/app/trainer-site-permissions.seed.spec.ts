import * as fs from 'fs';
import * as path from 'path';

const seedData = require('../assets/default-permissions.json');

describe('business-site permission seeds', () => {
  const shellSeedPath = path.resolve(process.cwd(), 'seed-permissions.sh');
  const shellSeed = fs.readFileSync(shellSeedPath, 'utf8');

  it('defines the business-site app scope and expected roles in default-permissions.json', () => {
    expect(
      seedData.app_scopes.some((scope: { name: string }) => scope.name === 'business-site')
    ).toBe(true);

    expect(
      seedData.roles.some(
        (role: { name: string; appScope: string }) =>
          role.name === 'business_site_owner' && role.appScope === 'business-site'
      )
    ).toBe(true);

    expect(
      seedData.roles.some(
        (role: { name: string; appScope: string }) =>
          role.name === 'business_site_client' && role.appScope === 'business-site'
      )
    ).toBe(true);
  });

  it('defines business-site configuration permissions', () => {
    const expectedPermissions = ['app-config.read', 'app-config.update'];

    for (const permission of expectedPermissions) {
      expect(
        seedData.permissions.some(
          (entry: { name: string; appScope: string }) =>
            entry.name === permission && entry.appScope === 'business-site'
        )
      ).toBe(true);
    }
  });

  it('maps business owner and client roles to the expected business-site permissions', () => {
    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'business_site_owner' &&
          entry.permission === 'app-config.update' &&
          entry.permissionAppScope === 'business-site'
      )
    ).toBe(true);

    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'business_site_owner' &&
          entry.permission === 'app-config.read' &&
          entry.permissionAppScope === 'business-site'
      )
    ).toBe(true);

    expect(
      seedData.role_permissions.some(
        (entry: { role: string; permission: string; permissionAppScope: string }) =>
          entry.role === 'business_site_client' &&
          entry.permission === 'app-config.read' &&
          entry.permissionAppScope === 'business-site'
      )
    ).toBe(true);
  });

  it('keeps the shell seed script aligned with the business-site permission model', () => {
    expect(shellSeed).toContain("('business-site', 'Business site");
    expect(shellSeed).toContain("('business_site_owner'");
    expect(shellSeed).toContain("('business_site_client'");
    expect(shellSeed).toContain("('app-config.update'");
    expect(shellSeed).toContain("('app-config.read'");
  });
});
