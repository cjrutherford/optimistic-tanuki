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

const communityPermissionResolver: ResolveFn<string[]> = async () => {
  const permissionsService = inject(UserPermissionsService);
  const permissions = await permissionsService.searchPermissions('community.');
  return permissions;
};

const communityIsLoggedInResolver: ResolveFn<boolean> = () => {
  const authState = inject(AuthStateService);
  return authState.isAuthenticated;
};

const communityUserIdResolver: ResolveFn<string> = () => {
  const authState = inject(AuthStateService);
  const profile = authState.getPersistedSelectedProfile();
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
  {
    path: 'feed/post/:postId',
    loadComponent: () =>
      import('./components/social/feed.component').then((m) => m.FeedComponent),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/profile.component').then((m) => m.ProfileComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'profile/:userId',
    loadComponent: () =>
      import('./components/profile.component').then((m) => m.ProfileComponent),
    canActivate: [AuthGuard, ProfileGuard],
  },
  // profile route removed — profile editing is available from Settings
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
    path: 'communities',
    loadChildren: () =>
      import('@optimistic-tanuki/community-ui').then((m) =>
        m.provideCommunityRoutes(
          communityPermissionResolver,
          communityIsLoggedInResolver,
          communityUserIdResolver
        )
      ),
    canActivate: [AuthGuard, ProfileGuard],
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
    path: 'settings/privacy',
    loadComponent: () =>
      import('./components/settings/privacy-settings.component').then(
        (m) => m.PrivacySettingsComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('./components/messages.component').then(
        (m) => m.MessagesComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./components/notifications/notifications-page.component').then(
        (m) => m.NotificationsPageComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'explore',
    loadComponent: () =>
      import('@optimistic-tanuki/search-ui').then(
        (m) => m.ExplorePageComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: 'activity',
    loadComponent: () =>
      import('./components/activity/activity-page.component').then(
        (m) => m.ActivityPageComponent
      ),
    canActivate: [AuthGuard, ProfileGuard],
  },
  {
    path: '**',
    redirectTo: 'feed',
  },
];
