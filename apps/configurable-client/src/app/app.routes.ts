import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { LandingPageComponent } from './components/landing-page.component';
import { AppResolverComponent } from './components/app-resolver.component';
import { ownerWorkspaceGuard } from './guards/owner-workspace.guard';
import { ownerWorkspaceConfigEditorDeactivateGuard } from './guards/owner-workspace-config-editor-deactivate.guard';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: 'login',
    title: 'Sign in to Configurable Client',
    loadComponent: () =>
      import('./components/configurable-client-login.component').then(
        (m) => m.ConfigurableClientLoginComponent
      ),
  },
  {
    path: 'owner',
    canActivate: [ownerWorkspaceGuard],
    loadComponent: () =>
      import('./components/owner-workspace-entry.component').then(
        (m) => m.OwnerWorkspaceEntryComponent
      ),
  },
  {
    path: 'owner/workspace/:workspaceSlug',
    canActivate: [ownerWorkspaceGuard],
    loadComponent: () =>
      import('./components/owner-workspace-dashboard.component').then(
        (m) => m.OwnerWorkspaceDashboardComponent
      ),
  },
  {
    path: 'owner/workspace/:workspaceSlug/author',
    canActivate: [ownerWorkspaceGuard],
    loadComponent: () =>
      import('./components/owner-workspace-authoring.component').then(
        (m) => m.OwnerWorkspaceAuthoringComponent
      ),
  },
  {
    path: 'owner/workspace/:workspaceSlug/author/:feature',
    canActivate: [ownerWorkspaceGuard],
    loadComponent: () =>
      import('./components/owner-workspace-authoring.component').then(
        (m) => m.OwnerWorkspaceAuthoringComponent
      ),
  },
  {
    path: 'owner/workspace/:workspaceSlug/config/:configId',
    canActivate: [ownerWorkspaceGuard],
    canDeactivate: [ownerWorkspaceConfigEditorDeactivateGuard],
    loadComponent: () =>
      import('./components/owner-workspace-config-editor.component').then(
        (m) => m.OwnerWorkspaceConfigEditorComponent
      ),
  },
  {
    path: 'config/:configId',
    component: AppResolverComponent,
    children: [
      { path: '', component: LandingPageComponent },
      { path: '**', component: LandingPageComponent },
    ],
  },
  {
    path: 'app/:appName',
    component: AppResolverComponent,
    children: [
      {
        path: '',
        component: LandingPageComponent,
      },
      { path: '**', component: LandingPageComponent },
    ],
  },
  {
    path: '',
    component: AppResolverComponent,
    children: [
      {
        path: '',
        component: LandingPageComponent,
      },
      { path: '**', component: LandingPageComponent },
    ],
  },
];
