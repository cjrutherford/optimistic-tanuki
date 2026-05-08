import { Route } from '@angular/router';
import { bookingFeatureGuard } from './booking-feature.guard';
import { businessAuthGuard } from './trainer-auth.guard';
import { clientAuthGuard } from './client-auth.guard';
import { clientPortalFeatureGuard } from './client-portal-feature.guard';
import { clientTasksFeatureGuard } from './client-tasks-feature.guard';
import { invoicesFeatureGuard } from './invoices-feature.guard';

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
];

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessLandingPageComponent
      ),
    title: 'Business',
  },
  {
    path: 'book',
    canActivate: [bookingFeatureGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/business-public-ui').then(
        (m) => m.BusinessBookingPageComponent
      ),
    title: 'Book Now',
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
        children: [
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
        ],
      },
    ],
  },
  {
    path: 'owner/login',
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessLoginPageComponent
      ),
    title: 'Owner Login',
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
