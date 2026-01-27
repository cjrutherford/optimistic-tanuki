import { Route, ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStateService } from './auth-state.service';

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
      import('./components/main-page/main-page.component').then(
        (m) => m.MainPageComponent
      ),
  },
  {
    path: 'forum',
    loadChildren: () => import('@optimistic-tanuki/forum-ui').then(m => m.provideForumRoutes(() => Promise.resolve(['forum.topic.create', 'forum.thread.create', 'forum.post.create']), forumIsLoggedInResolver, forumUserIdResolver)),
    canActivate: []
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./components/blog-page/blog-page.component').then(
        (m) => m.BlogPageComponent
      ),
  },
  {
    path: 'blog/:id',
    loadComponent: () =>
      import('./components/blog-page/blog-page.component').then(
        (m) => m.BlogPageComponent
      ),
    data: { id: null },
  },
];
