import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { LandingPageComponent } from './components/landing-page.component';
import { AppResolverComponent } from './components/app-resolver.component';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: 'app/:appName',
    component: AppResolverComponent,
    children: [
      {
        path: '',
        component: LandingPageComponent,
      },
      // Dynamic routes will be added here based on configuration
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
      // Dynamic routes will be added here based on configuration
    ],
  },
];
