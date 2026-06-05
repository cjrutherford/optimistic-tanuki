import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing-page.component').then(
        (m) => m.LandingPageComponent
      ),
    title: 'Signal Foundry',
  },
  {
    path: 'offers',
    loadComponent: () =>
      import('./pages/offers-page.component').then(
        (m) => m.OffersPageComponent
      ),
    title: 'Offer Workspaces',
  },
  {
    path: 'offers/new',
    loadComponent: () =>
      import('./pages/create-page.component').then(
        (m) => m.CreatePageComponent
      ),
    title: 'Create Offer Bundle',
  },
  {
    path: 'offers/:offerId',
    loadComponent: () =>
      import('./pages/results-page.component').then(
        (m) => m.ResultsPageComponent
      ),
    title: 'Offer Bundle Workspace',
  },
  { path: 'create', redirectTo: '/offers/new', pathMatch: 'full' },
  { path: 'results', redirectTo: '/offers', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
