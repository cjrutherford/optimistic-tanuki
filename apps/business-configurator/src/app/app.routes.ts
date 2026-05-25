import { Route } from '@angular/router';

export const appRoutes: Route[] = [
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
