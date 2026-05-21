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
    path: 'create',
    loadComponent: () =>
      import('./pages/create-page.component').then((m) => m.CreatePageComponent),
    title: 'Build Marketing Workbench',
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./pages/results-page.component').then(
        (m) => m.ResultsPageComponent
      ),
    title: 'Marketing Outputs',
  },
  { path: '**', redirectTo: '' },
];
