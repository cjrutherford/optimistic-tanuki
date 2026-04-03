import { Route } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { LeadsComponent } from './leads.component';
import { AnalyticsComponent } from './analytics.component';
import { TopicsComponent } from './topics.component';
import { authGuard } from './auth.guard';
import { alreadyAuthenticatedGuard } from './already-authenticated.guard';
import { profileGuard } from './profile.guard';
import {
  onboardingPageGuard,
  onboardingPageMatchGuard,
  onboardingRequiredGuard,
  onboardingRequiredMatchGuard,
} from './onboarding-gate.service';
import { OnboardingPageComponent } from './onboarding-page.component';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';
import { ProfileSetupComponent } from './profile-setup.component';
import { SettingsComponent } from './settings.component';
import { HomeRedirectComponent } from './home-redirect.component';

export const appRoutes: Route[] = [
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [alreadyAuthenticatedGuard],
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [alreadyAuthenticatedGuard],
  },
  {
    path: 'profile/setup',
    component: ProfileSetupComponent,
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard, profileGuard],
  },
  {
    path: 'onboarding',
    component: OnboardingPageComponent,
    canActivate: [authGuard, profileGuard, onboardingPageGuard],
    canMatch: [onboardingPageMatchGuard],
  },
  {
    path: '',
    component: HomeRedirectComponent,
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  {
    path: 'leads',
    component: LeadsComponent,
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  {
    path: 'topics',
    component: TopicsComponent,
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  {
    path: 'analytics',
    component: AnalyticsComponent,
    canActivate: [authGuard, profileGuard, onboardingRequiredGuard],
    canMatch: [onboardingRequiredMatchGuard],
  },
  { path: '**', redirectTo: '/' },
];
