// Per-app route lists. `routes` render without authentication; `skipped`
// records auth-guarded routes that were deliberately not captured.
// Add an entry here to make the harness usable for another app.
export const APPS = {
  'client-interface': {
    routes: ['/', '/login', '/register', '/forum'],
    skipped: [
      '/feed',
      '/profile',
      '/communities',
      '/settings',
      '/messages',
      '/notifications',
      '/explore',
      '/activity (AuthGuard/ProfileGuard)',
    ],
  },
  forgeofwill: {
    routes: ['/', '/login', '/register', '/forum'],
    skipped: [
      '/projects',
      '/profile',
      '/settings',
      '/invitations',
      '/messages (AuthenticationGuard/ProfileGuard)',
    ],
  },
  'christopherrutherford-net': {
    routes: ['/', '/forum'],
    skipped: [],
  },
  'digital-homestead': {
    routes: ['/', '/blog', '/login', '/forum'],
    skipped: ['/blog/:id (needs a post id from the API)'],
  },
  hai: { routes: ['/'], skipped: [] },
  'store-client': {
    routes: ['/catalog', '/cart', '/donations', '/bookings', '/forum'],
    skipped: [],
  },
  'leads-app': {
    routes: ['/', '/login', '/register'],
    skipped: [
      '/dashboard',
      '/leads',
      '/topics',
      '/analytics',
      '/settings',
      '/onboarding',
      '/profile/setup (authGuard)',
    ],
  },
  'local-hub': {
    routes: ['/', '/cities', '/communities', '/login', '/register'],
    skipped: [
      '/city/:slug*, /c/:communitySlug* (need API data)',
      '/account',
      '/seller-dashboard',
      '/messages (AuthGuard)',
    ],
  },
  'owner-console': {
    routes: ['/control-center', '/login'],
    skipped: [
      '/dashboard/* (authGuard); / redirects to /control-center; /register redirects to /login',
    ],
  },
  'fin-commander': {
    routes: ['/', '/demo', '/login', '/register'],
    skipped: [
      '/tenants/active/*, /tenants/:id/* (AuthGuard/ProfileGuard/onboarding)',
      '/onboarding',
      '/settings (AuthGuard)',
    ],
  },
  'business-site': {
    routes: [
      '/',
      '/auth',
      '/owner/register',
      '/sites/demo/client/login',
      '/sites/demo/owner/login',
    ],
    skipped: [
      '/owner/dashboard etc., /client/* portal (owner/client auth guards)',
      '/sites/:siteSlug, /products/:productId (need API data)',
    ],
  },
  'business-configurator': {
    routes: ['/login'],
    skipped: [
      '/ , /workspaces/:workspaceId/* (configuratorAuthGuard; / redirects to /login)',
    ],
  },
  'configurable-client': {
    routes: ['/', '/login', '/config/demo', '/app/demo'],
    skipped: ['/owner/* (ownerWorkspaceGuard)'],
  },
  d6: {
    routes: ['/', '/about', '/login', '/register'],
    skipped: [
      '/dashboard',
      '/daily-four',
      '/daily-six',
      '/feed',
      '/profile (AuthGuard/ProfileGuard)',
    ],
  },
  'developer-portal': { routes: ['/'], skipped: [] },
  learning: {
    routes: ['/', '/courses', '/sign-in', '/about', '/docs'],
    skipped: [
      '/course/:offeringId, /module/* (need API data)',
      '/dashboard, /author (may need auth data)',
    ],
  },
  'marketing-generator': {
    routes: ['/', '/offers', '/offers/new'],
    skipped: ['/offers/:offerId (needs API data)'],
  },
  'setup-console': { routes: ['/', '/setup'], skipped: [] },
  'system-configurator': {
    routes: ['/', '/review', '/login'],
    skipped: [
      '/configure/:chassisId (needs API data)',
      '/profile-gate',
      '/checkout',
      '/confirmation/:orderId (AuthenticationGuard/ProfileReadyGuard)',
    ],
  },
  'video-client': {
    routes: ['/', '/login', '/register'],
    skipped: [
      '/upload',
      '/profile',
      '/history',
      '/my-channel (authGuard)',
      '/watch/:id, /c/:slugOrId (need API data)',
    ],
  },
};
