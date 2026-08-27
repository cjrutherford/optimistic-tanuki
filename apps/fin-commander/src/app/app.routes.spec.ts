import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RedirectFunction } from '@angular/router';
import { FINANCE_HOST_CONFIG } from '@optimistic-tanuki/finance-ui';
import { appRoutes } from './app.routes';
import { ProfileGuard } from './guards/profile.guard';
import { onboardingCompleteGuard } from './guards/onboarding-complete.guard';
import { tenantRouteContextGuard } from './guards/tenant-route-context.guard';

describe('appRoutes', () => {
  it('redirects the legacy commander entry route to the tenant shell', () => {
    const commanderRoute = appRoutes.find(
      (route) => route.path === 'commander'
    );

    expect(commanderRoute).toBeDefined();
    expect(commanderRoute?.pathMatch).toBe('full');
    expect(commanderRoute?.redirectTo).toBe('/tenants/active/plans');
  });

  it('keeps legacy redirects absolute so they enter the guarded tenant shell', () => {
    const redirects = {
      account: '/tenants/active/overview',
      finance: '/tenants/active/accounts',
      commander: '/tenants/active/plans',
    };

    for (const [path, redirectTo] of Object.entries(redirects)) {
      const route = appRoutes.find((candidate) => candidate.path === path);

      expect(route).toBeDefined();
      expect(route?.redirectTo).toBe(redirectTo);
      expect(route?.canActivate).toBeUndefined();
    }
  });

  it('interpolates legacy route parameters before entering the tenant shell', () => {
    const redirects = {
      'finance/:workspace': {
        params: { workspace: 'personal' },
        expected: '/tenants/active/accounts/personal',
      },
      'finance/:workspace/:section': {
        params: { workspace: 'personal', section: 'accounts' },
        expected: '/tenants/active/accounts/personal/accounts',
      },
      'commander/:planId': {
        params: { planId: 'home-command' },
        expected: '/tenants/active/plans/home-command/overview',
      },
      'commander/:planId/:section': {
        params: { planId: 'home-command', section: 'overview' },
        expected: '/tenants/active/plans/home-command/overview',
      },
    };

    for (const [path, { params, expected }] of Object.entries(redirects)) {
      const route = appRoutes.find((candidate) => candidate.path === path);

      expect(typeof route?.redirectTo).toBe('function');
      expect((route?.redirectTo as RedirectFunction)({ params } as never)).toBe(
        expected
      );
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

  it('client-renders session-bound entry routes', () => {
    const serverRoutesSource = readFileSync(
      resolve(__dirname, 'app.routes.server.ts'),
      'utf8'
    );

    for (const path of [
      'onboarding',
      'settings',
      'finance/:workspace',
      'commander/:planId/:section',
    ]) {
      expect(serverRoutesSource).toContain(
        `path: '${path}',\n    renderMode: RenderMode.Client`
      );
    }
  });

  it('hydrates profile context before running tenant planning checks', () => {
    const tenantRoute = appRoutes.find(
      (route) => route.path === 'tenants/:tenantId'
    );

    expect(tenantRoute).toBeDefined();
    expect(tenantRoute?.canActivate).toEqual(
      expect.arrayContaining([
        ProfileGuard,
        tenantRouteContextGuard,
        onboardingCompleteGuard,
      ])
    );
  });

  it('provides tenant-scoped finance links to both tenant route variants', () => {
    for (const path of ['tenants/active', 'tenants/:tenantId']) {
      const route = appRoutes.find((candidate) => candidate.path === path);
      const provider = route?.providers?.find(
        (candidate) =>
          typeof candidate === 'object' &&
          candidate !== null &&
          'provide' in candidate &&
          candidate.provide === FINANCE_HOST_CONFIG
      ) as { useValue?: { routeBase?: string } } | undefined;

      expect(provider?.useValue?.routeBase).toBe('/tenants/:tenantId/accounts');
    }
  });
});
