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
          path: ':communityId/posts',
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
          path: 'manage/:communityId',
          redirectTo: 'manage/:communityId/members',
          pathMatch: 'full',
        },
        {
          path: 'manage/:communityId/members',
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
      ],
    },
  ];

  return communityRoutes;
}
