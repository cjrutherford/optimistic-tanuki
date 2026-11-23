import { inject } from '@angular/core';
import { Route, Router } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { appConfigDesignerDeactivateGuard } from './components/app-config-designer/app-config-designer-deactivate.guard';
import { AuthService } from './services/auth.service';
import { HOME_PATH } from './owner-nav';
import { noAccessGuard, ownerAccessGuard } from './guards/owner-access.guard';
import {
  emailAuthRoutes,
  OAuthCallbackComponent,
} from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  ...emailAuthRoutes('auth_token', true),
  {
    // The old public status page is gone: visitors sign in, owners go Home.
    path: 'control-center',
    redirectTo: () =>
      inject(AuthService).isAuthenticated() ? HOME_PATH : '/login',
  },
  {
    path: 'no-access',
    canActivate: [noAccessGuard],
    loadComponent: () =>
      import('./components/no-access.component').then(
        (m) => m.NoAccessComponent
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    redirectTo: () =>
      inject(Router).createUrlTree(['/login'], {
        queryParams: { provisioning: 'required' },
      }),
  },
  { path: 'oauth/callback', component: OAuthCallbackComponent },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [authGuard],
    canActivateChild: [ownerAccessGuard],
    children: [
      {
        path: 'directory-rights',
        loadComponent: () =>
          import('./components/directory-rights-page.component').then(
            (m) => m.DirectoryRightsPageComponent
          ),
      },
      {
        path: 'directory-withdrawals',
        loadComponent: () =>
          import('./components/directory-withdrawals-page.component').then(
            (m) => m.DirectoryWithdrawalsPageComponent
          ),
      },
      {
        path: 'directory-exports',
        loadComponent: () =>
          import('./components/directory-exports-page.component').then(
            (m) => m.DirectoryExportsPageComponent
          ),
      },
      {
        path: 'directory-operations',
        loadComponent: () =>
          import('./components/directory-operations-page.component').then(
            (m) => m.DirectoryOperationsPageComponent
          ),
      },
      {
        path: 'directory-taxonomy',
        loadComponent: () =>
          import('./components/directory-taxonomy-cases-page.component').then(
            (m) => m.DirectoryTaxonomyCasesPageComponent
          ),
      },
      {
        path: 'directory-taxonomy-runs',
        loadComponent: () =>
          import('./components/directory-taxonomy-runs-page.component').then(
            (m) => m.DirectoryTaxonomyRunsPageComponent
          ),
      },
      {
        path: 'directory-runs',
        loadComponent: () =>
          import('./components/directory-acquisition-runs-page.component').then(
            (m) => m.DirectoryAcquisitionRunsPageComponent
          ),
      },
      // Town picker, then every per-town page under /dashboard/towns/:townId.
      {
        path: 'towns',
        loadComponent: () =>
          import('./components/towns/towns-picker.component').then(
            (m) => m.TownsPickerComponent
          ),
      },
      {
        path: 'towns/:townId',
        redirectTo: '/dashboard/towns/:townId/overview',
        pathMatch: 'full',
      },
      {
        path: 'towns/:townId/overview',
        loadComponent: () =>
          import('./components/towns/town-overview.component').then(
            (m) => m.TownOverviewComponent
          ),
      },
      {
        path: 'towns/:townId/communities',
        loadComponent: () =>
          import('./components/towns/town-communities.component').then(
            (m) => m.TownCommunitiesComponent
          ),
      },
      {
        path: 'towns/:townId/boundary-review',
        loadComponent: () =>
          import('./components/boundary-review-page.component').then(
            (m) => m.BoundaryReviewPageComponent
          ),
      },
      {
        path: 'towns/:townId/directory-address-review',
        loadComponent: () =>
          import('./components/directory-address-review-page.component').then(
            (m) => m.DirectoryAddressReviewPageComponent
          ),
      },
      {
        path: 'towns/:townId/directory-identity-review',
        loadComponent: () =>
          import('./components/directory-identity-review-page.component').then(
            (m) => m.DirectoryIdentityReviewPageComponent
          ),
      },
      {
        path: 'towns/:townId/directory-link-review',
        loadComponent: () =>
          import('./components/directory-link-review-page.component').then(
            (m) => m.DirectoryLinkReviewPageComponent
          ),
      },
      {
        path: 'towns/:townId/directory-duplicates',
        loadComponent: () =>
          import('./components/directory-duplicate-review-page.component').then(
            (m) => m.DirectoryDuplicateReviewPageComponent
          ),
      },
      {
        path: 'towns/:townId/directory-listing-reports',
        loadComponent: () =>
          import('./components/directory-listing-report-page.component').then(
            (m) => m.DirectoryListingReportPageComponent
          ),
      },
      {
        path: 'towns/:townId/directory-listing-suppressions',
        loadComponent: () =>
          import(
            './components/directory-listing-suppression-page.component'
          ).then((m) => m.DirectoryListingSuppressionPageComponent),
      },
      // Old per-page URLs keep working: the town id moves into the new path.
      {
        path: 'boundary-review/:townId',
        redirectTo: '/dashboard/towns/:townId/boundary-review',
      },
      {
        path: 'directory-address-review/:townId',
        redirectTo: '/dashboard/towns/:townId/directory-address-review',
      },
      {
        path: 'directory-identity-review/:townId',
        redirectTo: '/dashboard/towns/:townId/directory-identity-review',
      },
      {
        path: 'directory-link-review/:townId',
        redirectTo: '/dashboard/towns/:townId/directory-link-review',
      },
      {
        path: 'directory-duplicates/:townId',
        redirectTo: '/dashboard/towns/:townId/directory-duplicates',
      },
      {
        path: 'directory-listing-reports/:townId',
        redirectTo: '/dashboard/towns/:townId/directory-listing-reports',
      },
      {
        path: 'directory-listing-suppressions/:townId',
        redirectTo: '/dashboard/towns/:townId/directory-listing-suppressions',
      },
      { path: 'community-ops', redirectTo: '/dashboard/towns' },
      {
        path: 'home',
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
        path: 'security',
        loadComponent: () =>
          import('./components/security-observability.component').then(
            (m) => m.SecurityObservabilityComponent
          ),
      },
      {
        path: 'performance',
        loadComponent: () =>
          import('./components/performance-observability.component').then(
            (m) => m.PerformanceObservabilityComponent
          ),
      },
      {
        path: 'deployments',
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
        path: 'tenants',
        loadComponent: () =>
          import(
            './components/whitebox-tenant-management/whitebox-tenant-management.component'
          ).then((m) => m.WhiteboxTenantManagementComponent),
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
        canDeactivate: [appConfigDesignerDeactivateGuard],
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
        canDeactivate: [appConfigDesignerDeactivateGuard],
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
      // Retired pages keep working as redirects so bookmarks land somewhere.
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'overview', redirectTo: 'home', pathMatch: 'full' },
      { path: 'control-center', redirectTo: 'deployments', pathMatch: 'full' },
      { path: 'governance', redirectTo: 'users', pathMatch: 'full' },
      { path: 'experience', redirectTo: 'app-config', pathMatch: 'full' },
      { path: 'commerce', redirectTo: 'store/overview', pathMatch: 'full' },
      { path: 'crm', redirectTo: 'contacts', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
];
