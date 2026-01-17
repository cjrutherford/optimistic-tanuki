import { Route } from '@angular/router';
import { LandingPageComponent } from './components/landing-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LandingPageComponent,
  },
  // Dynamic routes will be added here based on configuration
];
