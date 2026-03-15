import { ResolveFn, Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard'; // Import the AuthGuard
import { ProfileGuard } from './guards/profile.guard';
import { inject } from '@angular/core';
import { UserPermissionsService } from './state/user-permissions.service';
import { AuthStateService } from './state/auth-state.service';
import { OAuthCallbackComponent } from '@optimistic-tanuki/auth-ui';

const forumPermissionResolver: ResolveFn<string[]> = async () => {
  const permissionsService = inject(UserPermissionsService);
  const permissions = await permissionsService.searchPermissions('forum.');
  console.log('Forum permissionsResolver:', permissions);
  return permissions;
};

const forumIsLoggedInResolver: ResolveFn<boolean> = () => {
  const authState = inject(AuthStateService);
  const isLoggedIn = authState.isAuthenticated;
  console.log('Forum isLoggedInResolver:', isLoggedIn);
  return isLoggedIn;
};

const forumUserIdResolver: ResolveFn<string> = () => {
  const authState = inject(AuthStateService);
  const profile = authState.getPersistedSelectedProfile();
  console.log('Forum userIdResolver, profile:', profile);
  return profile?.id || '';
};

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
    path: 'oauth/callback',
    component: OAuthCallbackComponent,
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
    path: 'forum',
    loadChildren: () =>
      import('@optimistic-tanuki/forum-ui').then((m) =>
        m.provideForumRoutes(
          forumPermissionResolver,
          forumIsLoggedInResolver,
          forumUserIdResolver
        )
      ),
    canActivate: [AuthGuard, ProfileGuard], // Protect the forum route
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
