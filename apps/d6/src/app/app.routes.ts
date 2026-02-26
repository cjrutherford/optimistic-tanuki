import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { ProfileGuard } from './guards/profile.guard';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/loading/loading.component').then(
        (m) => m.LoadingComponent
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./components/about/about.component').then(
        (m) => m.AboutComponent
      ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'daily-four',
    loadComponent: () =>
      import('./components/daily-four/daily-four.component').then(
        (m) => m.DailyFourComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'daily-six',
    loadComponent: () =>
      import('./components/daily-six/daily-six.component').then(
        (m) => m.DailySixComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'feed',
    loadComponent: () =>
      import('./components/feed/feed.component').then(
        (m) => m.FeedComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/profile-page/profile-page.component').then(
        (m) => m.ProfilePageComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
