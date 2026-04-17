import { RenderMode, ServerRoute } from '@angular/ssr';

const serverRoutes: ServerRoute[] = [
  { path: 'c/:communitySlug', renderMode: RenderMode.Client },
  { path: 'c/:communitySlug/classifieds', renderMode: RenderMode.Client },
  { path: 'c/:communitySlug/classifieds/new', renderMode: RenderMode.Client },
  { path: 'c/:communitySlug/classifieds/:id', renderMode: RenderMode.Client },
  { path: 'city/:slug', renderMode: RenderMode.Client },
  { path: 'city/:slug/classifieds', renderMode: RenderMode.Client },
  { path: 'city/:slug/classifieds/new', renderMode: RenderMode.Client },
  { path: 'city/:slug/classifieds/:id', renderMode: RenderMode.Client },
  { path: 'communities', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'account', renderMode: RenderMode.Client },
  { path: 'seller-dashboard', renderMode: RenderMode.Client },
  { path: 'messages', renderMode: RenderMode.Client },
  { path: 'messages/new', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];

export default serverRoutes;
