import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: '',
    title: 'Business Site Builder',
    data: {
      editorMode: 'guided',
      workspaceKind: 'business-site',
    },
    loadComponent: () =>
      import('@optimistic-tanuki/business-portal-ui').then(
        (m) => m.BusinessSiteEditorPageComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
