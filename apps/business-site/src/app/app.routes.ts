import { Route } from '@angular/router';
import {
  createFinanceRoutes,
  FINANCE_HOST_CONFIG,
} from '@optimistic-tanuki/finance-ui';
import { bookingFeatureGuard } from './booking-feature.guard';
import { businessAuthGuard } from './trainer-auth.guard';
import { clientAuthGuard } from './client-auth.guard';
import { clientPortalFeatureGuard } from './client-portal-feature.guard';
import { clientTasksFeatureGuard } from './client-tasks-feature.guard';
import { invoicesFeatureGuard } from './invoices-feature.guard';
import { ownerFinanceFeatureGuard } from './owner-finance-feature.guard';
import {
  emailAuthRoutes,
  oauthCallbackRoutes,
} from '@optimistic-tanuki/auth-ui';

const ownerFinanceConfig = {
  routeBase: '/owner/finance',
  onboardingRoute: '/owner/finance/onboarding',
  shellTitle: 'Owner Finance',
  defaultWorkspace: 'business' as const,
  workspaceLabels: {
    business: {
      label: 'Owner Finance',
      navLabel: 'Billing',
      description: 'Invoices, checkout sessions, and business payments',
    },
  },
};

const ownerChildren: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerDashboardPageComponent
      ),
  },
  {
    path: 'site',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessSiteEditorPageComponent
      ),
  },
  {
    path: 'requests',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerRequestsPageComponent
      ),
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerClientsPageComponent
      ),
  },
  {
    path: 'availability',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerAvailabilityPageComponent
      ),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerProductsPageComponent
      ),
  },
  {
    path: 'finance',
    canActivate: [ownerFinanceFeatureGuard],
    providers: [
      {
        provide: FINANCE_HOST_CONFIG,
        useValue: ownerFinanceConfig,
      },
    ],
    children: createFinanceRoutes(ownerFinanceConfig),
  },
];

const clientChildren: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessClientPortalHomePageComponent
      ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessClientDashboardPageComponent
      ),
  },
  {
    path: 'routines',
    canActivate: [clientTasksFeatureGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessClientTasksPageComponent
      ),
  },
  {
    path: 'billing',
    canActivate: [invoicesFeatureGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessClientBillingPageComponent
      ),
  },
];

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  ...emailAuthRoutes('business-site:token'),
  {
    path: '',
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessPlatformHomePageComponent
      ),
    title: 'Business Platform',
  },
  {
    path: 'products/:productId',
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessProductDetailComponent
      ),
    title: 'View Product',
  },
  {
    path: 'sites/:siteSlug',
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessLandingPageComponent
      ),
    title: 'Business Site',
  },
  {
    path: 'sites/:siteSlug/products/:productId',
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessProductDetailComponent
      ),
    title: 'View Product',
  },
  {
    path: 'sites/:siteSlug/book',
    canActivate: [bookingFeatureGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessBookingPageComponent
      ),
    title: 'Book Now',
  },
  {
    path: 'sites/:siteSlug/client/login',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessClientLoginPageComponent
      ),
    title: 'Client Login',
  },
  {
    path: 'sites/:siteSlug/client/register',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessClientRegisterPageComponent
      ),
    title: 'Client Registration',
  },
  {
    path: 'sites/:siteSlug/owner/login',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessLoginPageComponent
      ),
    title: 'Owner Login',
  },
  {
    path: 'sites/:siteSlug/owner/register',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerRegisterPageComponent
      ),
    title: 'Owner Registration',
  },
  {
    path: 'sites/:siteSlug/client',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessPortalShellComponent
      ),
    canActivate: [clientAuthGuard, clientPortalFeatureGuard],
    data: {
      portalLabel: 'Client Portal',
      portalDescription: 'Your plan, sessions, and progress in one place.',
    },
    children: clientChildren,
  },
  {
    path: 'client',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('@optimistic-tanuki/business-portal-ui').then(
            (m) => m.BusinessClientLoginPageComponent
          ),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('@optimistic-tanuki/business-portal-ui').then(
            (m) => m.BusinessClientRegisterPageComponent
          ),
      },
      {
        path: '',
        loadComponent: () =>
          import('@optimistic-tanuki/business-portal-ui').then(
            (m) => m.BusinessPortalShellComponent
          ),
        canActivate: [clientAuthGuard, clientPortalFeatureGuard],
        data: {
          portalLabel: 'Client Portal',
          portalDescription: 'Your plan, sessions, and progress in one place.',
        },
        children: clientChildren,
      },
    ],
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessLoginPageComponent
      ),
    title: 'Sign In',
  },
  {
    path: 'owner/login',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'owner/register',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessOwnerRegisterPageComponent
      ),
    title: 'Owner Registration',
  },
  {
    path: 'owner/onboarding',
    canActivate: [businessAuthGuard],
    data: {
      editorMode: 'guided',
      onboardingMode: true,
    },
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessSiteEditorPageComponent
      ),
    title: 'Owner Onboarding',
  },
  {
    path: 'sites/:siteSlug/owner',
    canActivate: [businessAuthGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessPortalShellComponent
      ),
    data: {
      portalLabel: 'Owner Workspace',
      portalDescription: 'Manage clients, requests, and settings.',
    },
    children: ownerChildren,
  },
  {
    path: 'owner',
    canActivate: [businessAuthGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessPortalShellComponent
      ),
    data: {
      portalLabel: 'Owner Workspace',
      portalDescription: 'Manage clients, requests, and settings.',
    },
    children: ownerChildren,
  },
  { path: '**', redirectTo: '' },
];
