import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';
import { bookingFeatureGuard } from './booking-feature.guard';
import { clientAuthGuard } from './client-auth.guard';
import { clientPortalFeatureGuard } from './client-portal-feature.guard';
import { clientTasksFeatureGuard } from './client-tasks-feature.guard';
import { invoicesFeatureGuard } from './invoices-feature.guard';
import { ownerFinanceFeatureGuard } from './owner-finance-feature.guard';

describe('appRoutes', () => {
  it('registers the shared OAuth popup callback before application routes', () => {
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

  it('exposes public, client, and owner route families', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        '',
        'sites/:siteSlug',
        'sites/:siteSlug/book',
        'sites/:siteSlug/client',
        'sites/:siteSlug/client/login',
        'sites/:siteSlug/client/register',
        'sites/:siteSlug/owner/login',
        'sites/:siteSlug/owner/register',
        'sites/:siteSlug/owner',
        'client',
        'auth',
        'owner/login',
        'owner/register',
        'owner/onboarding',
        'owner',
        '**',
      ])
    );
  });

  it('registers client portal child routes', () => {
    const clientRoute = appRoutes.find((route) => route.path === 'client');
    const portalShellRoute = (clientRoute?.children ?? []).find(
      (route) => route.path === ''
    );

    expect((clientRoute?.children ?? []).map((route) => route.path)).toEqual(
      expect.arrayContaining(['login', 'register', ''])
    );
    expect(
      (portalShellRoute?.children ?? []).map((route) => route.path)
    ).toEqual(expect.arrayContaining(['', 'dashboard', 'routines', 'billing']));
    expect(portalShellRoute?.canActivate).toEqual([
      clientAuthGuard,
      clientPortalFeatureGuard,
    ]);
    expect(
      (portalShellRoute?.children ?? []).find(
        (route) => route.path === 'routines'
      )?.canActivate
    ).toEqual([clientTasksFeatureGuard]);
    expect(
      (portalShellRoute?.children ?? []).find(
        (route) => route.path === 'billing'
      )?.canActivate
    ).toEqual([invoicesFeatureGuard]);
  });

  it('registers hosted client portal child routes for business-scoped access', () => {
    const hostedClientRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug/client'
    );

    expect(
      (hostedClientRoute?.children ?? []).map((route) => route.path)
    ).toEqual(expect.arrayContaining(['', 'dashboard', 'routines', 'billing']));
    expect(hostedClientRoute?.canActivate).toEqual([
      clientAuthGuard,
      clientPortalFeatureGuard,
    ]);
    expect(
      (hostedClientRoute?.children ?? []).find(
        (route) => route.path === 'routines'
      )?.canActivate
    ).toEqual([clientTasksFeatureGuard]);
    expect(
      (hostedClientRoute?.children ?? []).find(
        (route) => route.path === 'billing'
      )?.canActivate
    ).toEqual([invoicesFeatureGuard]);
  });

  it('uses a full-match default route so client child pages can resolve', () => {
    const clientRoute = appRoutes.find((route) => route.path === 'client');
    const portalShellRoute = (clientRoute?.children ?? []).find(
      (route) => route.path === ''
    );
    const defaultChildRoute = (portalShellRoute?.children ?? []).find(
      (route) => route.path === ''
    );

    expect(defaultChildRoute?.pathMatch).toBe('full');
  });

  it('registers owner workspace child routes', () => {
    const ownerRoute = appRoutes.find((route) => route.path === 'owner');
    expect((ownerRoute?.children ?? []).map((route) => route.path)).toEqual(
      expect.arrayContaining([
        'dashboard',
        'site',
        'requests',
        'clients',
        'availability',
        'finance',
      ])
    );
  });

  it('registers hosted owner workspace child routes for business-scoped access', () => {
    const hostedOwnerRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug/owner'
    );

    expect(
      (hostedOwnerRoute?.children ?? []).map((route) => route.path)
    ).toEqual(
      expect.arrayContaining([
        'dashboard',
        'site',
        'requests',
        'clients',
        'availability',
        'finance',
      ])
    );
  });

  it('adds a tenant-scoped public route for hosted business sites', () => {
    const tenantRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug'
    );

    expect(tenantRoute?.title).toBe('Business Site');
  });

  it('adds public product detail routes for hosted and root business sites', () => {
    expect(
      appRoutes.find((route) => route.path === 'products/:productId')
    ).toBeTruthy();
    expect(
      appRoutes.find(
        (route) => route.path === 'sites/:siteSlug/products/:productId'
      )
    ).toBeTruthy();
  });

  it('configures the shared auth and owner onboarding routes for the new owner workflow', () => {
    const authRoute = appRoutes.find((route) => route.path === 'auth');
    const ownerLoginRoute = appRoutes.find(
      (route) => route.path === 'owner/login'
    );
    const ownerRegisterRoute = appRoutes.find(
      (route) => route.path === 'owner/register'
    );
    const onboardingRoute = appRoutes.find(
      (route) => route.path === 'owner/onboarding'
    );

    expect(authRoute?.title).toBe('Sign In');
    expect(ownerLoginRoute).toEqual(
      expect.objectContaining({
        redirectTo: 'auth',
        pathMatch: 'full',
      })
    );
    expect(ownerRegisterRoute?.title).toBe('Owner Registration');
    expect(onboardingRoute?.data).toEqual({
      editorMode: 'guided',
      onboardingMode: true,
    });
  });

  it('adds hosted owner auth routes for business-scoped login and registration', () => {
    const hostedOwnerLoginRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug/owner/login'
    );
    const hostedOwnerRegisterRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug/owner/register'
    );

    expect(hostedOwnerLoginRoute?.title).toBe('Owner Login');
    expect(hostedOwnerRegisterRoute?.title).toBe('Owner Registration');
  });

  it('mounts the shared finance utilities under the owner workspace', () => {
    const ownerRoute = appRoutes.find((route) => route.path === 'owner');
    const financeRoute = (ownerRoute?.children ?? []).find(
      (route) => route.path === 'finance'
    );

    expect(financeRoute?.canActivate).toEqual([ownerFinanceFeatureGuard]);
    expect((financeRoute?.children ?? [])[1]?.children?.[0]?.redirectTo).toBe(
      'business'
    );
    expect(
      (financeRoute?.children ?? [])[1]?.children?.map((route) => route.path)
    ).toEqual(
      expect.arrayContaining([
        ':workspace/invoices',
        ':workspace/invoices/new',
        ':workspace/checkout',
        ':workspace/payments',
      ])
    );
  });

  it('protects the booking route behind the booking feature flag', () => {
    const tenantBookingRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug/book'
    );

    expect(appRoutes.find((route) => route.path === 'book')).toBeUndefined();
    expect(tenantBookingRoute?.canActivate).toEqual([bookingFeatureGuard]);
  });

  it('adds hosted client auth routes for business-scoped login and registration', () => {
    expect(
      appRoutes.find((route) => route.path === 'sites/:siteSlug/client/login')
    ).toBeTruthy();
    expect(
      appRoutes.find(
        (route) => route.path === 'sites/:siteSlug/client/register'
      )
    ).toBeTruthy();
  });

  it('lazy loads the platform home, tenant site, auth page, and onboarding editor components', async () => {
    const platformRoute = appRoutes.find((route) => route.path === '');
    const tenantRoute = appRoutes.find(
      (route) => route.path === 'sites/:siteSlug'
    );
    const authRoute = appRoutes.find((route) => route.path === 'auth');
    const ownerRegisterRoute = appRoutes.find(
      (route) => route.path === 'owner/register'
    );
    const onboardingRoute = appRoutes.find(
      (route) => route.path === 'owner/onboarding'
    );

    await expect(platformRoute?.loadComponent?.()).resolves.toHaveProperty(
      'name',
      'BusinessPlatformHomePageComponent'
    );
    await expect(tenantRoute?.loadComponent?.()).resolves.toHaveProperty(
      'name',
      'BusinessLandingPageComponent'
    );
    await expect(authRoute?.loadComponent?.()).resolves.toHaveProperty(
      'name',
      'BusinessLoginPageComponent'
    );
    await expect(ownerRegisterRoute?.loadComponent?.()).resolves.toHaveProperty(
      'name',
      'BusinessOwnerRegisterPageComponent'
    );
    await expect(onboardingRoute?.loadComponent?.()).resolves.toHaveProperty(
      'name',
      'BusinessSiteEditorPageComponent'
    );
  });
});
