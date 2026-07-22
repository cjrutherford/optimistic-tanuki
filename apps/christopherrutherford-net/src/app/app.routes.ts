import { Route } from '@angular/router';
import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';

export const appRoutes: Route[] = [
  ...oauthCallbackRoutes,
  {
    path: 'forum',
    loadChildren: () =>
      import('@optimistic-tanuki/forum-ui').then((m) =>
        m.provideForumRoutes(
          () =>
            Promise.resolve([
              'forum.topic.create',
              'forum.thread.create',
              'forum.post.create',
            ]),
          () => true,
          () => 'guest-user'
        )
      ),
    canActivate: [],
  },
  {
    path: '**',
    loadComponent: () =>
      import('../landing/landing.component').then((m) => m.LandingComponent),
  },
];
