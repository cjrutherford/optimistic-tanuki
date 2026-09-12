import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { configuratorAuthGuard } from './auth/configurator-auth.guard';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: 'login',
    title: 'Sign in to Configurator',
    loadComponent: () =>
      import('./pages/configurator-login-page.component').then(
        (m) => m.ConfiguratorLoginPageComponent
      ),
  },
  {
    path: '',
    title: 'Configurator Workspace',
    canActivate: [configuratorAuthGuard],
    loadComponent: () =>
      import('./pages/workspace-picker-page.component').then(
        (m) => m.WorkspacePickerPageComponent
      ),
  },
  {
    path: 'workspaces/:workspaceId/sites/:siteSlug',
    title: 'Business Site Builder',
    canActivate: [configuratorAuthGuard],
    data: {
      editorMode: 'guided',
      workspaceKind: 'business-site',
    },
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessSiteEditorPageComponent
      ),
  },
  {
    path: 'workspaces/:workspaceId/authoring/:product',
    title: 'Workspace Authoring',
    canActivate: [configuratorAuthGuard],
    loadComponent: () =>
      import('./pages/product-authoring-page.component').then(
        (m) => m.ProductAuthoringPageComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
