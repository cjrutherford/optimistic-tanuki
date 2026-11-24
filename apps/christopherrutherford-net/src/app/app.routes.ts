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
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('../landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    // Anything else is a real 404, not a duplicate of the homepage.
    path: '**',
    loadComponent: () =>
      import('./not-found/not-found.component').then(
        (m) => m.NotFoundComponent
      ),
  },
];
