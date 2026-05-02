import { Route } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { OPERATOR_WORKSPACES } from './operator-workspaces';
import { OAuthCallbackComponent } from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  { path: 'oauth/callback', component: OAuthCallbackComponent },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'overview',
        loadComponent: () =>
          import('./components/operator-overview.component').then(
            (m) => m.OperatorOverviewComponent
          ),
      },
      {
        path: OPERATOR_WORKSPACES[0].path,
        loadComponent: () =>
          import('./components/workspace-landing.component').then(
            (m) => m.WorkspaceLandingComponent
          ),
        data: {
          title: OPERATOR_WORKSPACES[0].label,
          description: OPERATOR_WORKSPACES[0].description,
          summary: OPERATOR_WORKSPACES[0].summary,
          checklist: OPERATOR_WORKSPACES[0].checklist,
          cards: OPERATOR_WORKSPACES[0].cards,
        },
      },
      {
        path: OPERATOR_WORKSPACES[1].path,
        loadComponent: () =>
          import('./components/workspace-landing.component').then(
            (m) => m.WorkspaceLandingComponent
          ),
        data: {
          title: OPERATOR_WORKSPACES[1].label,
          description: OPERATOR_WORKSPACES[1].description,
          summary: OPERATOR_WORKSPACES[1].summary,
          checklist: OPERATOR_WORKSPACES[1].checklist,
          cards: OPERATOR_WORKSPACES[1].cards,
        },
      },
      {
        path: OPERATOR_WORKSPACES[2].path,
        loadComponent: () =>
          import('./components/workspace-landing.component').then(
            (m) => m.WorkspaceLandingComponent
          ),
        data: {
          title: OPERATOR_WORKSPACES[2].label,
          description: OPERATOR_WORKSPACES[2].description,
          summary: OPERATOR_WORKSPACES[2].summary,
          checklist: OPERATOR_WORKSPACES[2].checklist,
          cards: OPERATOR_WORKSPACES[2].cards,
        },
      },
      {
        path: OPERATOR_WORKSPACES[3].path,
        loadComponent: () =>
          import('./components/workspace-landing.component').then(
            (m) => m.WorkspaceLandingComponent
          ),
        data: {
          title: OPERATOR_WORKSPACES[3].label,
          description: OPERATOR_WORKSPACES[3].description,
          summary: OPERATOR_WORKSPACES[3].summary,
          checklist: OPERATOR_WORKSPACES[3].checklist,
          cards: OPERATOR_WORKSPACES[3].cards,
        },
      },
      {
        path: 'operations',
        loadComponent: () =>
          import('./components/operations-workspace.component').then(
            (m) => m.OperationsWorkspaceComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./components/users-management.component').then(
            (m) => m.UsersManagementComponent
          ),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./components/roles-management.component').then(
            (m) => m.RolesManagementComponent
          ),
      },
      {
        path: 'permissions',
        loadComponent: () =>
          import('./components/permissions-management.component').then(
            (m) => m.PermissionsManagementComponent
          ),
      },
      {
        path: 'permissions-inspector',
        loadComponent: () =>
          import('./components/permissions-inspector.component').then(
            (m) => m.PermissionsInspectorComponent
          ),
      },
      {
        path: 'app-scopes',
        loadComponent: () =>
          import('./components/app-scopes-management.component').then(
            (m) => m.AppScopesManagementComponent
          ),
      },
      {
        path: 'theme',
        loadComponent: () =>
          import('./components/theme-management.component').then(
            (m) => m.ThemeManagementComponent
          ),
      },
      {
        path: 'registry',
        loadComponent: () =>
          import('./components/registry-management.component').then(
            (m) => m.RegistryManagementComponent
          ),
      },
      {
        path: 'store/overview',
        loadComponent: () =>
          import('./components/store-overview.component').then(
            (m) => m.StoreOverviewComponent
          ),
      },
      {
        path: 'store/products',
        loadComponent: () =>
          import('./components/product-management.component').then(
            (m) => m.ProductManagementComponent
          ),
      },
      {
        path: 'store/orders',
        loadComponent: () =>
          import('./components/order-management.component').then(
            (m) => m.OrderManagementComponent
          ),
      },
      {
        path: 'app-config',
        loadComponent: () =>
          import(
            './components/app-config-designer/app-config-list.component'
          ).then((m) => m.AppConfigListComponent),
      },
      {
        path: 'app-config/designer',
        loadComponent: () =>
          import(
            './components/app-config-designer/app-config-designer.component'
          ).then((m) => m.AppConfigDesignerComponent),
      },
      {
        path: 'app-config/designer/:id',
        loadComponent: () =>
          import(
            './components/app-config-designer/app-config-designer.component'
          ).then((m) => m.AppConfigDesignerComponent),
      },
      {
        path: 'store/appointments',
        loadComponent: () =>
          import('./components/appointment-management.component').then(
            (m) => m.AppointmentManagementComponent
          ),
      },
      {
        path: 'store/availability',
        loadComponent: () =>
          import('./components/availability-management.component').then(
            (m) => m.AvailabilityManagementComponent
          ),
      },
      {
        path: 'communities',
        loadComponent: () =>
          import('./components/community-management.component').then(
            (m) => m.CommunityManagementComponent
          ),
      },
      {
        path: 'communities/new',
        loadComponent: () =>
          import('./components/community-editor.component').then(
            (m) => m.CommunityEditorComponent
          ),
      },
      {
        path: 'communities/:id',
        loadComponent: () =>
          import('./components/community-editor.component').then(
            (m) => m.CommunityEditorComponent
          ),
      },
      {
        path: 'communities/:id/members',
        loadComponent: () =>
          import('./components/community-members.component').then(
            (m) => m.CommunityMembersComponent
          ),
      },
      {
        path: 'cities',
        loadComponent: () =>
          import('./components/city-management.component').then(
            (m) => m.CityManagementComponent
          ),
      },
      {
        path: 'cities/new',
        loadComponent: () =>
          import('./components/city-editor.component').then(
            (m) => m.CityEditorComponent
          ),
      },
      {
        path: 'cities/:id',
        loadComponent: () =>
          import('./components/city-editor.component').then(
            (m) => m.CityEditorComponent
          ),
      },
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
];
