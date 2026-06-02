import { appRoutes } from './app.routes';
import { bookingFeatureGuard } from './booking-feature.guard';
import { clientAuthGuard } from './client-auth.guard';
import { clientPortalFeatureGuard } from './client-portal-feature.guard';
import { clientTasksFeatureGuard } from './client-tasks-feature.guard';
import { invoicesFeatureGuard } from './invoices-feature.guard';
import { ownerFinanceFeatureGuard } from './owner-finance-feature.guard';

describe('appRoutes', () => {
  it('exposes public, client, and owner route families', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        '',
        'book',
        'client',
        'owner/login',
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
    const bookingRoute = appRoutes.find((route) => route.path === 'book');
    expect(bookingRoute?.canActivate).toEqual([bookingFeatureGuard]);
  });
});
