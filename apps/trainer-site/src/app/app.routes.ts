import { Route } from '@angular/router';
import { trainerAuthGuard } from './trainer-auth.guard';
import { TrainerClientLoginPageComponent } from '@optimistic-tanuki/trainer-portal-ui';
import { clientAuthGuard } from './client-auth.guard';

const trainerChildren: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-portal-ui').then(
        (m) => m.TrainerOwnerDashboardPageComponent
      ),
  },
  {
    path: 'site',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-portal-ui').then(
        (m) => m.TrainerSiteEditorPageComponent
      ),
  },
  {
    path: 'requests',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-portal-ui').then(
        (m) => m.TrainerOwnerRequestsPageComponent
      ),
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-portal-ui').then(
        (m) => m.TrainerOwnerClientsPageComponent
      ),
  },
];

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-public-ui').then(
        (m) => m.TrainerLandingPageComponent
      ),
    title: 'Forge Training Co.',
  },
  {
    path: 'book',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-public-ui').then(
        (m) => m.TrainerBookingPageComponent
      ),
    title: 'Consultation Request',
  },
  {
    path: 'client',
    children: [
      {
        path: 'login',
        component: TrainerClientLoginPageComponent,
      },
      {
        path: '',
        loadComponent: () =>
          import('@optimistic-tanuki/trainer-portal-ui').then(
            (m) => m.TrainerPortalShellComponent
          ),
        canActivate: [clientAuthGuard],
        data: {
          portalLabel: 'Client Portal',
          portalDescription: 'Your plan, sessions, check-ins, and billing in one place.',
        },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('@optimistic-tanuki/trainer-portal-ui').then(
                (m) => m.TrainerClientPortalHomePageComponent
              ),
          },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('@optimistic-tanuki/trainer-portal-ui').then(
                (m) => m.TrainerClientDashboardPageComponent
              ),
          },
          {
            path: 'routines',
            loadComponent: () =>
              import('@optimistic-tanuki/trainer-portal-ui').then(
                (m) => m.TrainerClientRoutinesPageComponent
              ),
          },
          {
            path: 'billing',
            loadComponent: () =>
              import('@optimistic-tanuki/trainer-portal-ui').then(
                (m) => m.TrainerClientBillingPageComponent
              ),
          },
        ],
      },
    ],
  },
  {
    path: 'trainer/login',
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-portal-ui').then(
        (m) => m.TrainerLoginPageComponent
      ),
    title: 'Trainer Login',
  },
  {
    path: 'trainer',
    canActivate: [trainerAuthGuard],
    loadComponent: () =>
      import('@optimistic-tanuki/trainer-portal-ui').then(
        (m) => m.TrainerPortalShellComponent
      ),
    data: {
      portalLabel: 'Trainer Workspace',
      portalDescription: 'Client management, programming, requests, and invoices.',
    },
    children: trainerChildren,
  },
  { path: '**', redirectTo: '' },
];
