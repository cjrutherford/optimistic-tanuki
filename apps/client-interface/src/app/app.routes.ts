import { Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard'; // Import the AuthGuard
import { ProfileGuard } from './guards/profile.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./components/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'feed',
    loadComponent: () =>
      import('./components/social/feed.component').then((m) => m.FeedComponent),
    canActivate: [AuthGuard, ProfileGuard], // Protect the feed route
  },
  // profile route removed — profile editing is available from Settings
  {
    path: 'tasks',
    loadComponent: () =>
      import('./components/tasks/tasks.component').then(
        (m) => m.TasksComponent
      ),
    canActivate: [AuthGuard, ProfileGuard], // Protect the tasks route
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings.component').then(
        (m) => m.SettingsComponent
      ),
    canActivate: [AuthGuard], // Protect the settings route
  },
  {
    path: '**',
    redirectTo: 'feed',
  },
];
