import { Route } from '@angular/router';
import {
  emailAuthRoutes,
  OAuthCallbackComponent,
} from '@optimistic-tanuki/auth-ui';
import { authGuard } from './auth.guard';
import { alreadyAuthenticatedGuard } from './already-authenticated.guard';
import { profileGuard } from './profile.guard';
import {
  onboardingPageGuard,
  onboardingPageMatchGuard,
  onboardingRequiredGuard,
  onboardingRequiredMatchGuard,
} from './onboarding-gate.service';

export const appRoutes: Route[] = [
  ...emailAuthRoutes('ot-leads-authToken', true),
  {
    path: 'register',
    loadComponent: () =>
      import('./register.component').then((m) => m.RegisterComponent),
    canActivate: [alreadyAuthenticatedGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login.component').then((m) => m.LoginComponent),
    canActivate: [alreadyAuthenticatedGuard],
  },
  {
    path: 'oauth/callback',
    component: OAuthCallbackComponent,
  },
  {
    path: 'oauth/callback/:provider',
    component: OAuthCallbackComponent,
  },
  {
    path: 'profile/setup',
    loadComponent: () =>
      import('./profile-setup.component').then((m) => m.ProfileSetupComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./onboarding-page.component').then(
        (m) => m.OnboardingPageComponent
      ),
    canActivate: [authGuard, profileGuard, onboardingPageGuard],
    canMatch: [onboardingPageMatchGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./landing.component').then((m) => m.LandingComponent),
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  {
    path: 'leads',
    loadComponent: () =>
      import('./leads.component').then((m) => m.LeadsComponent),
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  {
    path: 'topics',
    loadComponent: () =>
      import('./topics.component').then((m) => m.TopicsComponent),
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./analytics.component').then((m) => m.AnalyticsComponent),
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  { path: '**', redirectTo: '/' },
];
