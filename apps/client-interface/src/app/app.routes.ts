import { ResolveFn, Route } from '@angular/router';
import { AuthGuard } from './guards/auth.guard'; // Import the AuthGuard
import { ProfileGuard } from './guards/profile.guard';
import { inject } from '@angular/core';
import { UserPermissionsService } from './state/user-permissions.service';
import { AuthStateService } from './state/auth-state.service';
import {
  emailAuthRoutes,
  guardianConsentRoutes,
  OAuthCallbackComponent,
} from '@optimistic-tanuki/auth-ui';
import { ExplorePageComponent } from '@optimistic-tanuki/search-ui';
import { PublicContactPageComponent } from '@optimistic-tanuki/common-ui';

interface ForumPermissionResolution {
  permissions: string[];
  unavailable?: true;
  denied?: true;
}

const forumPermissionResolver: ResolveFn<
  string[] | ForumPermissionResolution
> = async () => {
  const authState = inject(AuthStateService);
  if (!authState.isAuthenticated) {
    return [];
  }
  const permissionsService = inject(UserPermissionsService);
  try {
    const permissions = await permissionsService.searchPermissions('forum.');
    console.log('Forum permissionsResolver:', permissions);
    return permissions;
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 401) {
      // AuthInterceptor owns session expiry and redirects to the login route.
      return [];
    }
    if (status === 403) {
      return { permissions: [], denied: true };
    }
    // Keep the public forum route usable during transient service failures,
    // while hiding authoring controls and offering an explicit retry.
    return { permissions: [], unavailable: true };
  }
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
  // Cookie-authenticated first-time sessions may not have a persisted profile
  // selection yet. The session response carries the account's profile id.
  return profile?.id || authState.getDecodedTokenValue()?.profileId || '';
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
  ...emailAuthRoutes('ot-client-authToken', true),
  ...guardianConsentRoutes(),
  {
    path: 'contact',
    component: PublicContactPageComponent,
  },
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
    path: 'oauth/callback/:provider',
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
    path: 'guardian',
    loadComponent: () =>
      import('@optimistic-tanuki/guardian-ui').then(
        (m) => m.GuardianConsoleComponent
      ),
    canActivate: [AuthGuard],
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
    component: ExplorePageComponent,
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
