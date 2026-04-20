import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appRoutes } from './app.routes';
import { ProfileGuard } from './guards/profile.guard';
import { onboardingCompleteGuard } from './guards/onboarding-complete.guard';

describe('appRoutes', () => {
  it('redirects the commander entry route to the no-plan overview path', () => {
    const commanderRoute = appRoutes.find(
      (route) => route.path === 'commander'
    );

    expect(commanderRoute).toBeDefined();
    expect(commanderRoute?.pathMatch).toBe('full');
    expect(commanderRoute?.redirectTo).toBe('commander/new/overview');
  });

  it('registers the commander entry route with server rendering', () => {
    const serverRoutesSource = readFileSync(
      resolve(__dirname, 'app.routes.server.ts'),
      'utf8'
    );

    expect(serverRoutesSource).not.toContain("path: 'commander'");
    expect(serverRoutesSource).toContain("path: 'commander/:planId/overview'");
  });

  it('hydrates profile context before running commander onboarding checks', () => {
    const commanderRoute = appRoutes.find(
      (route) => route.path === 'commander/:planId'
    );

    expect(commanderRoute).toBeDefined();
    expect(commanderRoute?.canActivate).toEqual(
      expect.arrayContaining([ProfileGuard, onboardingCompleteGuard])
    );
  });
});
