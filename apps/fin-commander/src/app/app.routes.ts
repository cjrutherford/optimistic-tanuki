import { Route } from '@angular/router';
import {
  createFinanceRoutes,
  FINANCE_HOST_CONFIG,
} from '@optimistic-tanuki/finance-ui';
import {
  emailAuthRoutes,
  OAuthCallbackComponent,
} from '@optimistic-tanuki/auth-ui';
import { AuthGuard } from './guards/auth.guard';
import { onboardingCompleteGuard } from './guards/onboarding-complete.guard';
import { ProfileGuard } from './guards/profile.guard';
import { tenantRouteContextGuard } from './guards/tenant-route-context.guard';

export const FINANCE_ROUTE_PATH = 'finance';
export const TENANT_ROUTE_PATH = 'tenants/:tenantId';
export const LOGIN_ROUTE_PATH = 'login';
export const REGISTER_ROUTE_PATH = 'register';

const planChildren: Route[] = [
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

const tenantFinanceConfig = {
  routeBase: '/tenants/:tenantId/accounts',
  shellTitle: 'Tenant Accounts',
  shellLede:
    'Keep accounts, transactions, and setup work aligned for this tenant.',
  showWorkspaceSubnav: false,
};

const tenantFinanceChildren = createFinanceRoutes(tenantFinanceConfig).filter(
  (route) => route.path !== 'onboarding'
);

const tenantChildren: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview',
  },
  {
    path: 'overview',
    loadComponent: () =>
      import('./pages/account/account-page.component').then(
        (m) => m.AccountPageComponent
      ),
  },
  {
    path: 'members',
    loadComponent: () =>
      import('./pages/entity-members/entity-members-page.component').then(
        (m) => m.EntityMembersPageComponent
      ),
  },
  {
    path: 'plans',
    loadComponent: () =>
      import('./pages/plans/plans-page.component').then(
        (m) => m.PlansPageComponent
      ),
  },
  {
    path: 'plans/:planId',
    children: planChildren,
  },
  {
    path: 'accounts',
    children: tenantFinanceChildren,
  },
];

export const appRoutes: Route[] = [
  ...emailAuthRoutes('fin-commander-auth-authToken', true),
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
    path: 'oauth/callback',
    component: OAuthCallbackComponent,
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
    pathMatch: 'full',
    redirectTo: '/tenants/active/overview',
  },
  {
    path: FINANCE_ROUTE_PATH,
    pathMatch: 'full',
    redirectTo: '/tenants/active/accounts',
  },
  {
    path: `${FINANCE_ROUTE_PATH}/:workspace`,
    redirectTo: ({ params }) =>
      `/tenants/active/accounts/${params['workspace']}`,
  },
  {
    path: `${FINANCE_ROUTE_PATH}/:workspace/:section`,
    redirectTo: ({ params }) =>
      `/tenants/active/accounts/${params['workspace']}/${params['section']}`,
  },
  {
    path: 'commander',
    pathMatch: 'full',
    redirectTo: '/tenants/active/plans',
  },
  {
    path: 'commander/:planId',
    pathMatch: 'full',
    redirectTo: ({ params }) =>
      `/tenants/active/plans/${params['planId']}/overview`,
  },
  {
    path: 'commander/:planId/:section',
    redirectTo: ({ params }) =>
      `/tenants/active/plans/${params['planId']}/${params['section']}`,
  },
  {
    path: 'tenants/active',
    canActivate: [
      AuthGuard,
      ProfileGuard,
      tenantRouteContextGuard,
      onboardingCompleteGuard,
    ],
    providers: [
      {
        provide: FINANCE_HOST_CONFIG,
        useValue: tenantFinanceConfig,
      },
    ],
    loadComponent: () =>
      import('./pages/tenant-shell/tenant-shell.component').then(
        (m) => m.TenantShellComponent
      ),
    children: tenantChildren,
  },
  {
    path: TENANT_ROUTE_PATH,
    canActivate: [
      AuthGuard,
      ProfileGuard,
      tenantRouteContextGuard,
      onboardingCompleteGuard,
    ],
    providers: [
      {
        provide: FINANCE_HOST_CONFIG,
        useValue: tenantFinanceConfig,
      },
    ],
    loadComponent: () =>
      import('./pages/tenant-shell/tenant-shell.component').then(
        (m) => m.TenantShellComponent
      ),
    children: tenantChildren,
  },
];
