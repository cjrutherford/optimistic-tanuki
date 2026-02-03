import { Routes } from '@angular/router';

export const financeRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'accounts',
    loadComponent: () =>
      import('./account-list/account-list.component').then(
        (m) => m.AccountListComponent
      ),
  },
  {
    path: 'accounts/:id',
    loadComponent: () =>
      import('./account-form/account-form.component').then(
        (m) => m.AccountFormComponent
      ),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./transaction-list/transaction-list.component').then(
        (m) => m.TransactionListComponent
      ),
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'budgets',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
];
