import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: '',
    loadComponent: () =>
      import('./components/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
];
