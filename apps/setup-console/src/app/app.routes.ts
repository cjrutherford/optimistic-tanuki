import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { BootstrapOnboardingComponent } from './components/bootstrap-onboarding.component';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  { path: '', component: BootstrapOnboardingComponent },
  { path: 'setup', component: BootstrapOnboardingComponent },
];
