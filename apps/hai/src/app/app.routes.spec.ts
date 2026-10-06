import { Type } from '@angular/core';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';
import { SITE_NAVIGATION } from './content/navigation';
import { AppShellNavLink } from '@optimistic-tanuki/navigation-ui';

function navRoutes(links: AppShellNavLink[]): string[] {
  return links.flatMap((link) => [
    ...(link.route ? [link.route] : []),
    ...navRoutes([...(link.children ?? [])]),
  ]);
}

describe('hai appRoutes', () => {
  it('registers the shared OAuth popup callback before the landing page', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['oauth/callback'])
    );
    expect(appRoutes.find((route) => route.path === 'oauth/callback')).toBe(
      oauthCallbackRoutes[0]
    );
    expect(
      appRoutes.findIndex((route) => route.path === 'oauth/callback')
    ).toBeLessThan(appRoutes.findIndex((route) => route.path === ''));
  });

  it('gives every offering its own route', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        'private-cloud',
        'private-cloud/home',
        'private-cloud/organizations',
        'private-cloud/open-source-stack',
        'private-cloud/assessment',
        'turn-key-appliances',
        'software-stacks',
        'cost-comparison',
        'custom-software',
        'partners',
        'how-we-work',
        'contact',
      ])
    );
  });

  it('has a route for every page in the navigation', () => {
    const paths = appRoutes.map((route) => `/${route.path}`);

    for (const route of navRoutes(SITE_NAVIGATION)) {
      expect(paths).toContain(route);
    }
  });

  it.each(
    appRoutes
      .filter((route) => route.loadComponent)
      .map((route) => [route.path ?? '', route] as const)
  )('loads a component for "%s"', async (_path, route) => {
    const component = (await route.loadComponent?.()) as Type<unknown>;

    expect(typeof component).toBe('function');
  });
});
