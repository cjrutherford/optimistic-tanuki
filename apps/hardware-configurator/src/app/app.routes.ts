import { Route } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { ConfigureComponent } from './pages/configure/configure.component';
import { ReviewComponent } from './pages/review/review.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ConfirmationComponent } from './pages/confirmation/confirmation.component';

export const appRoutes: Route[] = [
  { path: '', component: LandingComponent },
  { path: 'configure/:chassisId', component: ConfigureComponent },
  { path: 'review', component: ReviewComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'confirmation/:orderId', component: ConfirmationComponent },
];
