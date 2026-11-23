import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

@Component({ standalone: true, template: '' })
class StubComponent {}

/** The real dashboard children with every lazy page swapped for a stub. */
const dashboardChildren = (
  appRoutes.find((route) => route.path === 'dashboard')?.children ?? []
).map(
  (route): Route =>
    route.loadComponent
      ? { ...route, loadComponent: undefined, component: StubComponent }
      : route
);

describe('town routes and old URL redirects', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'dashboard', children: dashboardChildren }]),
      ],
    });
    router = TestBed.inject(Router);
  });

  const landOn = async (url: string): Promise<string> => {
    await router.navigateByUrl(url);
    return router.url;
  };

  it.each([
    ['directory-link-review'],
    ['directory-address-review'],
    ['directory-identity-review'],
    ['directory-duplicates'],
    ['directory-listing-reports'],
    ['directory-listing-suppressions'],
    ['boundary-review'],
  ])('redirects /dashboard/%s/:id to the town form', async (page) => {
    expect(await landOn(`/dashboard/${page}/town-7`)).toBe(
      `/dashboard/towns/town-7/${page}`
    );
  });

  it('redirects /dashboard/community-ops to the town picker', async () => {
    expect(await landOn('/dashboard/community-ops')).toBe('/dashboard/towns');
  });

  it('opens a bare town on its overview', async () => {
    expect(await landOn('/dashboard/towns/town-7')).toBe(
      '/dashboard/towns/town-7/overview'
    );
  });

  it.each([
    'overview',
    'communities',
    'boundary-review',
    'directory-address-review',
    'directory-identity-review',
    'directory-link-review',
    'directory-duplicates',
    'directory-listing-reports',
    'directory-listing-suppressions',
    'daylight',
  ])('routes /dashboard/towns/:townId/%s without redirecting', async (page) => {
    const url = `/dashboard/towns/town-7/${page}`;
    expect(await landOn(url)).toBe(url);
  });

  it('routes Daylight for every town without a town in the URL', async () => {
    expect(await landOn('/dashboard/daylight')).toBe('/dashboard/daylight');
  });
});
