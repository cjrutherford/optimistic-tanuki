import { Routes } from '@angular/router';
import { financeHostReadyGuard } from './guards/finance-host-ready.guard';
import {
  DEFAULT_FINANCE_HOST_CONFIG,
  type FinanceHostConfig,
} from './tokens/finance-host-config.token';

export function createFinanceRoutes(
  config: Partial<FinanceHostConfig> = {}
): Routes {
  const resolvedConfig = { ...DEFAULT_FINANCE_HOST_CONFIG, ...config };

  return [
    {
      path: 'onboarding',
      canActivate: [financeHostReadyGuard],
      loadComponent: () =>
        import('./onboarding/onboarding.component').then(
          (m) => m.OnboardingComponent
        ),
    },
    {
      path: '',
      canActivate: [financeHostReadyGuard],
      loadComponent: () =>
        import('./finance-shell/finance-shell.component').then(
          (m) => m.FinanceShellComponent
        ),
      children: [
        {
          path: '',
          pathMatch: 'full',
          redirectTo: resolvedConfig.defaultWorkspace,
        },
        {
          path: ':workspace',
          loadComponent: () =>
            import('./dashboard/dashboard.component').then(
              (m) => m.DashboardComponent
            ),
        },
        {
          path: ':workspace/setup',
          loadComponent: () =>
            import('./setup-checklist/setup-checklist.component').then(
              (m) => m.SetupChecklistComponent
            ),
        },
        {
          path: ':workspace/accounts',
          loadComponent: () =>
            import('./account-list/account-list.component').then(
              (m) => m.AccountListComponent
            ),
        },
        {
          path: ':workspace/transactions',
          loadComponent: () =>
            import('./transaction-list/transaction-list.component').then(
              (m) => m.TransactionListComponent
            ),
        },
        {
          path: ':workspace/budgets',
          loadComponent: () =>
            import('./budget-planner/budget-planner.component').then(
              (m) => m.BudgetPlannerComponent
            ),
        },
        {
          path: ':workspace/recurring',
          loadComponent: () =>
            import('./recurring-list/recurring-list.component').then(
              (m) => m.RecurringListComponent
            ),
        },
        {
          path: 'net-worth/assets',
          loadComponent: () =>
            import('./asset-tracker/asset-tracker.component').then(
              (m) => m.AssetTrackerComponent
            ),
        },
      ],
    },
  ];
}

export const financeRoutes: Routes = createFinanceRoutes();

export { financeHostReadyGuard } from './guards/finance-host-ready.guard';
export {
  FINANCE_HOST_CONFIG,
  DEFAULT_FINANCE_HOST_CONFIG,
} from './tokens/finance-host-config.token';
export type { FinanceHostConfig } from './tokens/finance-host-config.token';
