import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appRoutes } from './app.routes';
import { ProfileGuard } from './guards/profile.guard';
import { onboardingCompleteGuard } from './guards/onboarding-complete.guard';

describe('appRoutes', () => {
  it('redirects the legacy commander entry route to the tenant shell', () => {
    const commanderRoute = appRoutes.find(
      (route) => route.path === 'commander'
    );

    expect(commanderRoute).toBeDefined();
    expect(commanderRoute?.pathMatch).toBe('full');
    expect(commanderRoute?.redirectTo).toBe('tenants/active/plans');
  });

  it('keeps legacy redirect routes unguarded and relies on the tenant shell guards', () => {
    const legacyRoutes = [
      'account',
      'finance',
      'finance/:workspace',
      'finance/:workspace/:section',
    ];

    for (const path of legacyRoutes) {
      const route = appRoutes.find((candidate) => candidate.path === path);

      expect(route).toBeDefined();
      expect(route?.redirectTo).toContain('tenants/active/');
      expect(route?.canActivate).toBeUndefined();
    }
  });

  it('registers tenant-first routes with server rendering', () => {
    const serverRoutesSource = readFileSync(
      resolve(__dirname, 'app.routes.server.ts'),
      'utf8'
    );

    expect(serverRoutesSource).toContain("path: 'tenants/:tenantId'");
    expect(serverRoutesSource).toContain(
      "path: 'tenants/:tenantId/plans/:planId/overview'"
    );
  });

  it('hydrates profile context before running tenant planning checks', () => {
    const tenantRoute = appRoutes.find(
      (route) => route.path === 'tenants/:tenantId'
    );

    expect(tenantRoute).toBeDefined();
    expect(tenantRoute?.canActivate).toEqual(
      expect.arrayContaining([ProfileGuard, onboardingCompleteGuard])
    );
  });
});
