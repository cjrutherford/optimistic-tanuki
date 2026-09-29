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
};
