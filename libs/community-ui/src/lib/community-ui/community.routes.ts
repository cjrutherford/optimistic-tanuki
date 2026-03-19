import { Route } from '@angular/router';
import { CommunityShellComponent } from './shell/community-shell.component';

export function provideCommunityRoutes(
  permissionsResolver: any,
  isLoggedInResolver: any,
  userIdResolver: any
): Route[] {
  const communityRoutes: Route[] = [
    {
      path: '',
      component: CommunityShellComponent,
      resolve: {
        userValidPermissions: permissionsResolver,
        userLoggedIn: isLoggedInResolver,
        currentUserId: userIdResolver,
      },
      children: [
        {
          path: '',
          loadComponent: () =>
            import('./find-communities/find-communities.component').then(
              (m) => m.FindCommunitiesComponent
            ),
        },
        {
          path: 'create',
          resolve: {
            userValidPermissions: permissionsResolver,
            userLoggedIn: isLoggedInResolver,
            currentUserId: userIdResolver,
          },
          loadComponent: () =>
            import('./create-community/create-community.component').then(
              (m) => m.CreateCommunityComponent
            ),
        },
        {
          path: 'manage',
          resolve: {
            userValidPermissions: permissionsResolver,
            userLoggedIn: isLoggedInResolver,
            currentUserId: userIdResolver,
          },
          loadComponent: () =>
            import('./manage-groups/manage-groups.component').then(
              (m) => m.ManageGroupsComponent
            ),
        },
        {
          path: 'manage/:communitySlug',
          redirectTo: 'manage/:communitySlug/members',
          pathMatch: 'full',
        },
        {
          path: 'manage/:communitySlug/members',
          resolve: {
            userValidPermissions: permissionsResolver,
            userLoggedIn: isLoggedInResolver,
            currentUserId: userIdResolver,
          },
          loadComponent: () =>
            import('./manage-members/manage-members.component').then(
              (m) => m.ManageMembersComponent
            ),
        },
        {
          path: ':communitySlug',
          redirectTo: ':communitySlug/posts',
          pathMatch: 'full',
        },
        {
          path: ':communitySlug/posts',
          resolve: {
            userValidPermissions: permissionsResolver,
            userLoggedIn: isLoggedInResolver,
            currentUserId: userIdResolver,
          },
          loadComponent: () =>
            import('./community-posts/community-posts.component').then(
              (m) => m.CommunityPostsComponent
            ),
        },
        {
          path: ':communitySlug/chat',
          resolve: {
            userValidPermissions: permissionsResolver,
            userLoggedIn: isLoggedInResolver,
            currentUserId: userIdResolver,
          },
          loadComponent: () =>
            import('./community-chat/community-chat.component').then(
              (m) => m.CommunityChatComponent
            ),
        },
      ],
    },
  ];

  return communityRoutes;
}
