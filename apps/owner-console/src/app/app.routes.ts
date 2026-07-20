import { Route } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { OPERATOR_WORKSPACES } from './operator-workspaces';
import {
  emailAuthRoutes,
  OAuthCallbackComponent,
} from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  ...emailAuthRoutes('auth_token'),
  {
    path: 'control-center',
    loadComponent: () =>
      import('./components/public-control-center.component').then(
        (m) => m.PublicControlCenterComponent
      ),
  },
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
        path: 'community-ops',
        loadComponent: () =>
          import('./components/community-ops-workspace.component').then(
            (m) => m.CommunityOpsWorkspaceComponent
          ),
      },
      {
        path: 'experience',
        loadComponent: () =>
          import('./components/experience-workspace.component').then(
            (m) => m.ExperienceWorkspaceComponent
          ),
      },
      ...OPERATOR_WORKSPACES.filter(
        (workspace) =>
          workspace.path !== 'community-ops' && workspace.path !== 'experience'
      ).map((workspace) => ({
        path: workspace.path,
        loadComponent: () =>
          import('./components/workspace-landing.component').then(
            (m) => m.WorkspaceLandingComponent
          ),
        data: {
          title: workspace.label,
          description: workspace.description,
          summary: workspace.summary,
          checklist: workspace.checklist,
          cards: workspace.cards,
        },
      })),
      {
        path: 'overview',
        loadComponent: () =>
          import('./components/operator-overview.component').then(
            (m) => m.OperatorOverviewComponent
          ),
      },
      {
        path: 'operations',
        loadComponent: () =>
          import('./components/operations-workspace.component').then(
            (m) => m.OperationsWorkspaceComponent
          ),
      },
      {
        path: 'video-processing',
        loadComponent: () =>
          import('./components/video-processing-monitor.component').then(
            (m) => m.VideoProcessingMonitorComponent
          ),
      },
      {
        path: 'control-center',
        loadComponent: () =>
          import('./components/admin-control-center.component').then(
            (m) => m.AdminControlCenterComponent
          ),
      },
      {
        path: 'oauth-inspector',
        loadComponent: () =>
          import('./components/admin-control-center.component').then(
            (m) => m.AdminControlCenterComponent
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
        path: 'store/business-site',
        loadComponent: () =>
          import(
            './components/business-site-catalog-management.component'
          ).then((m) => m.BusinessSiteCatalogManagementComponent),
      },
      {
        path: 'business-site/catalog',
        redirectTo: 'store/business-site',
        pathMatch: 'full',
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
        data: {
          editorMode: 'guided',
          workspaceKind: 'app-config',
        },
      },
      {
        path: 'app-config/designer/:id',
        loadComponent: () =>
          import(
            './components/app-config-designer/app-config-designer.component'
          ).then((m) => m.AppConfigDesignerComponent),
        data: {
          editorMode: 'studio',
          workspaceKind: 'app-config',
        },
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
        path: 'store/resources',
        loadComponent: () =>
          import('./components/resource-management.component').then(
            (m) => m.ResourceManagementComponent
          ),
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./components/contact-leads-management.component').then(
            (m) => m.ContactLeadsManagementComponent
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
        path: 'social-governance',
        loadComponent: () =>
          import('./components/social-governance.component').then(
            (m) => m.SocialGovernanceComponent
          ),
      },
      {
        path: 'forum-governance',
        loadComponent: () =>
          import('./components/forum-governance.component').then(
            (m) => m.ForumGovernanceComponent
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
  { path: '', redirectTo: '/control-center', pathMatch: 'full' },
];
