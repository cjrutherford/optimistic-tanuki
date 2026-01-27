
import { ResolveFn, Route } from '@angular/router';
import { ForumShellComponent } from './shell/forum-shell.component';

export function provideForumRoutes(
  permissionsResolver: ResolveFn<string[]>,
  isLoggedInResolver: ResolveFn<boolean>,
  userIdResolver: ResolveFn<string>
): Route[] {
  const forumRoutes: Route[] = [
    {
      path: '',
      component: ForumShellComponent,
      resolve: {
        userValidPermissions: permissionsResolver,
        userLoggedIn: isLoggedInResolver,
        currentUserId: userIdResolver
      }
    },
    {
      path: 'topic/:topicId',
      component: ForumShellComponent,
      resolve: {
        userValidPermissions: permissionsResolver,
        userLoggedIn: isLoggedInResolver,
        currentUserId: userIdResolver
      }
    },
    {
      path: 'thread/:threadId',
      component: ForumShellComponent,
      resolve: {
        userValidPermissions: permissionsResolver,
        userLoggedIn: isLoggedInResolver,
        currentUserId: userIdResolver
      }
    },
  ];
  return forumRoutes;
}


