import { Route } from '@angular/router';
import { BootstrapOnboardingComponent } from './components/bootstrap-onboarding.component';

export const appRoutes: Route[] = [
  { path: '', component: BootstrapOnboardingComponent },
  { path: 'setup', component: BootstrapOnboardingComponent },
];
