import { Route, ResolveFn } from '@angular/router';
import { AuthenticationGuard } from './authentication.guard';
import { ProfileGuard } from './profile.guard';
import { inject } from '@angular/core';
import { UserPermissionsService } from './user-permissions.service';
import { AuthStateService } from './auth-state.service';

const forumPermissionResolver = async () => {
  const permissionsService = inject(UserPermissionsService);
  const startsWith = 'forum.';
  const permissions = await permissionsService.searchPermissions(startsWith);
  return permissions;
}

const forumIsLoggedInResolver: ResolveFn<boolean> = () => {
  const authState = inject(AuthStateService);
  return !!authState.getDecodedTokenValue();
};

const forumUserIdResolver: ResolveFn<string> = () => {
  const authState = inject(AuthStateService);
  return authState.getDecodedTokenValue()?.userId || '';
};


export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/projects/projects.component').then(
        (m) => m.ProjectsComponent
      ),
    title: 'Projects',
    canActivate: [AuthenticationGuard, ProfileGuard],
  },
  {
    path: 'forum',
    loadChildren: () => import('@optimistic-tanuki/forum-ui').then(m => m.provideForumRoutes(forumPermissionResolver, forumIsLoggedInResolver, forumUserIdResolver)),
  },
  // profile route removed; profile editing is available from Settings
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent
      ),
    title: 'Settings',
    canActivate: [AuthenticationGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
    title: 'Login',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(
        (m) => m.RegisterComponent
      ),
    title: 'Register',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
