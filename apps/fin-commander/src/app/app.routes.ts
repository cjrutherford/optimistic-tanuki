import { Route } from '@angular/router';
import { financeRoutes } from '@optimistic-tanuki/finance-ui';
import { AuthGuard } from './guards/auth.guard';
import { onboardingCompleteGuard } from './guards/onboarding-complete.guard';
import { ProfileGuard } from './guards/profile.guard';

export const FINANCE_ROUTE_PATH = 'finance';
export const COMMANDER_ROUTE_PATH = 'commander/:planId';
export const LOGIN_ROUTE_PATH = 'login';
export const REGISTER_ROUTE_PATH = 'register';

const commanderChildren: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview',
  },
  {
    path: 'overview',
    loadComponent: () =>
      import('./pages/overview/overview-page.component').then(
        (m) => m.OverviewPageComponent
      ),
  },
  {
    path: 'cash-flow',
    loadComponent: () =>
      import('./pages/cash-flow/cash-flow-page.component').then(
        (m) => m.CashFlowPageComponent
      ),
  },
  {
    path: 'goals',
    loadComponent: () =>
      import('./pages/goals/goals-page.component').then(
        (m) => m.GoalsPageComponent
      ),
  },
  {
    path: 'scenarios',
    loadComponent: () =>
      import('./pages/scenarios/scenarios-page.component').then(
        (m) => m.ScenariosPageComponent
      ),
  },
  {
    path: 'imports',
    loadComponent: () =>
      import('./pages/imports/imports-page.component').then(
        (m) => m.ImportsPageComponent
      ),
  },
];

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./components/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
  {
    path: 'demo',
    loadComponent: () =>
      import('./components/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
  {
    path: 'onboarding',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent
      ),
  },
  {
    path: LOGIN_ROUTE_PATH,
    loadComponent: () =>
      import('./components/login.component').then((m) => m.LoginComponent),
  },
  {
    path: REGISTER_ROUTE_PATH,
    loadComponent: () =>
      import('./components/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'settings',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/settings.component').then(
        (m) => m.SettingsComponent
      ),
  },
  {
    path: 'account',
    canActivate: [AuthGuard, ProfileGuard],
    loadComponent: () =>
      import('./pages/account/account-page.component').then(
        (m) => m.AccountPageComponent
      ),
  },
  {
    path: FINANCE_ROUTE_PATH,
    canActivate: [AuthGuard, ProfileGuard],
    children: financeRoutes,
  },
  {
    path: 'commander',
    pathMatch: 'full',
    redirectTo: 'commander/new/overview',
  },
  {
    path: COMMANDER_ROUTE_PATH,
    canActivate: [AuthGuard, ProfileGuard, onboardingCompleteGuard],
    loadComponent: () =>
      import('./pages/commander-shell/commander-shell.component').then(
        (m) => m.CommanderShellComponent
      ),
    children: commanderChildren,
  },
];
