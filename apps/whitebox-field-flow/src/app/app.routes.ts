import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'estimate',
  },
  {
    path: 'estimate',
    loadComponent: () =>
      import('./components/estimate/estimate.component').then(
        (m) => m.EstimateComponent
      ),
  },
  {
    path: 'book',
    loadComponent: () =>
      import('./components/book/book.component').then((m) => m.BookComponent),
  },
  {
    path: 'deposit',
    loadComponent: () =>
      import('./components/deposit/deposit.component').then(
        (m) => m.DepositComponent
      ),
  },
  {
    path: 'status/:id',
    loadComponent: () =>
      import('./components/status/status.component').then(
        (m) => m.StatusComponent
      ),
  },
  {
    path: 'demo',
    loadComponent: () =>
      import('./components/demo/demo.component').then((m) => m.DemoComponent),
  },
  {
    path: 'field-flow/demo',
    loadComponent: () =>
      import('./components/demo/demo.component').then((m) => m.DemoComponent),
  },
  {
    path: '**',
    redirectTo: 'estimate',
  },
];
