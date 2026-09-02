import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'projects', renderMode: RenderMode.Client },
  { path: 'profile', renderMode: RenderMode.Client },
  { path: 'settings', renderMode: RenderMode.Client },
  { path: 'messages', renderMode: RenderMode.Client },
  { path: 'messages/new', renderMode: RenderMode.Client },
  { path: 'invitations', renderMode: RenderMode.Client },
  // Rendered in the browser rather than prerendered. A prerendered route with
  // a parameter needs the list of values ahead of time, and the values here
  // are invitation tokens: unguessable on purpose, one per invitation, and
  // not something to enumerate at build time even if it were possible.
  { path: 'invitations/:token', renderMode: RenderMode.Client },
  { path: 'oauth/callback', renderMode: RenderMode.Client },
  { path: 'oauth/callback/:provider', renderMode: RenderMode.Client },
  {
    path: 'forum/topic/:topicId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'forum/thread/:threadId',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
