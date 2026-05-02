import { Route } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { ConfigureComponent } from './pages/configure/configure.component';
import { ReviewComponent } from './pages/review/review.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { ConfirmationComponent } from './pages/confirmation/confirmation.component';
import { AuthenticationGuard } from './auth/authentication.guard';
import { AlreadyAuthenticatedGuard } from './auth/already-authenticated.guard';
import { ProfileReadyGuard } from './auth/profile-ready.guard';
import { OAuthCallbackComponent } from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  { path: '', component: LandingComponent, title: 'HAI Computer' },
  {
    path: 'configure/:chassisId',
    component: ConfigureComponent,
    title: 'Configure System',
  },
  { path: 'review', component: ReviewComponent, title: 'Review Build' },
  {
    path: 'login',
    canActivate: [AlreadyAuthenticatedGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    title: 'Log In',
  },
  {
    path: 'oauth/callback',
    component: OAuthCallbackComponent,
    title: 'OAuth Callback',
  },
  {
    path: 'profile-gate',
    canActivate: [AuthenticationGuard],
    loadComponent: () =>
      import('./pages/profile-gate/profile-gate.component').then(
        (m) => m.ProfileGateComponent
      ),
    title: 'Choose Profile',
  },
  {
    path: 'checkout',
    component: CheckoutComponent,
    canActivate: [AuthenticationGuard, ProfileReadyGuard],
    title: 'Checkout',
  },
  {
    path: 'confirmation/:orderId',
    component: ConfirmationComponent,
    canActivate: [AuthenticationGuard, ProfileReadyGuard],
    title: 'Order Confirmation',
  },
  { path: '**', redirectTo: '' },
];
