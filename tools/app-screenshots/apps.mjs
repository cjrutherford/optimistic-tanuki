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
    routes: [
      '/catalog?catalogId=5e5d0c47-4a1b-4c8e-9f2a-3b7d6c1e0a01',
      '/cart',
      '/donations',
      '/bookings',
      '/forum',
    ],
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
    routes: ['/', '/login'],
    skipped: [
      '/owner/* (ownerWorkspaceGuard)',
      '/config/:appId (appId is generated at seed time; there is no "demo" app)',
      '/app/:appName (by-name lookup needs a workspace selector; gateway answers 400)',
    ],
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

// --- live mode (capture.mjs --live) -----------------------------------------
// `url`: host URL of the app's running docker-compose.dev.yaml container.
// `login`: seeded account (scripts/dev-seed.sh) filled into the app's own form.
// `auth`: authenticated routes captured when login succeeds.
// `modeNote`: set when the app deliberately ignores the user's light/dark mode.
const SOCIAL = {
  email: 'social.alice@example.com',
  password: 'TestPassword123!',
};
const OWNER = {
  email: 'owner@optimistic-tanuki.local',
  password: 'DevOwner!123',
};
const BIZ_OWNER = {
  email: 'owner-artist@localbusiness.test',
  password: 'BusinessOwnerPass123!',
};
const BIZ_CLIENT = {
  email: 'client@localbusiness.test',
  password: 'ClientPass123!',
};
const LIVE = {
  'client-interface': {
    url: 'http://127.0.0.1:8080',
    login: { route: '/login', ...SOCIAL },
    auth: ['/feed', '/profile', '/communities', '/settings', '/messages'],
  },
  forgeofwill: {
    url: 'http://127.0.0.1:8081',
    login: { route: '/login', ...SOCIAL },
    auth: ['/projects', '/profile', '/settings', '/invitations', '/messages'],
  },
  'digital-homestead': {
    url: 'http://127.0.0.1:8082',
    login: { route: '/login', ...SOCIAL },
    auth: [],
  },
  'christopherrutherford-net': { url: 'http://127.0.0.1:8083' },
  'owner-console': {
    url: 'http://127.0.0.1:8084',
    login: { route: '/login', ...OWNER },
    auth: [
      '/dashboard',
      '/dashboard/overview',
      '/dashboard/users',
      '/dashboard/theme',
      '/dashboard/registry',
    ],
  },
  'store-client': { url: 'http://127.0.0.1:8085' },
  d6: {
    url: 'http://127.0.0.1:8086',
    login: { route: '/login', ...SOCIAL },
    auth: ['/dashboard', '/daily-four', '/daily-six', '/feed', '/profile'],
  },
  'local-hub': {
    url: 'http://127.0.0.1:8087',
    login: { route: '/login', ...SOCIAL },
    auth: ['/account', '/seller-dashboard', '/messages'],
  },
  hai: { url: 'http://127.0.0.1:8088' },
  'fin-commander': {
    url: 'http://127.0.0.1:8089',
    login: { route: '/login', ...SOCIAL },
    auth: ['/onboarding', '/settings', '/account'],
  },
  'configurable-client': {
    modeNote:
      "Mode comes from the tenant theme config (TenantThemeService.DEFAULT_MODE=light, theme.mode); the user's dark request is honoured only on some routes.",
    url: 'http://127.0.0.1:8090',
    login: {
      route: '/login',
      email: 'configurable-client-owner-v2@optimistic-tanuki.local',
      password: 'DevConfigurableClient!123',
    },
    auth: ['/owner'],
  },
  'system-configurator': {
    modeNote:
      'Rendered surface is dark in both requested modes (light request only sets data-mode).',
    url: 'http://127.0.0.1:8091',
    login: { route: '/login', ...SOCIAL },
    auth: ['/profile-gate', '/checkout'],
  },
  'marketing-generator': { url: 'http://127.0.0.1:8092' },
  'video-client': {
    url: 'http://127.0.0.1:8093',
    login: { route: '/login', ...SOCIAL },
    auth: ['/upload', '/profile', '/history', '/my-channel'],
  },
  'business-site': {
    modeNote:
      'Public /sites/:slug pages take their mode from the site theme, not the user request (some dark requests render light, emberline owner area renders dark).',
    url: 'http://127.0.0.1:8094',
    login: {
      route: '/sites/emberline-studio/owner/login',
      inPage: true,
      ...BIZ_OWNER,
    },
    auth: ['/sites/emberline-studio/owner', '/owner/dashboard'],
  },
  'leads-app': {
    url: 'http://127.0.0.1:8095',
    login: { route: '/login', ...SOCIAL },
    auth: ['/dashboard', '/leads', '/topics', '/analytics', '/settings'],
  },
  'business-configurator': {
    modeNote:
      'Fixed dark by design: apps/business-configurator/src/styles.scss defines a dark hardware-editorial palette; the light request only sets data-mode=light, the rendered surface stays dark.',
    url: 'http://127.0.0.1:8096',
    login: { route: '/login', ...BIZ_OWNER },
    auth: [],
  },
  'developer-portal': {
    url: 'http://127.0.0.1:8097',
    modeNote:
      'Fixed dark by design: apps/developer-portal/src/styles.scss renders a dark editorial surface regardless of the user theme preference.',
  },
  learning: {
    url: 'http://127.0.0.1:8099',
    login: { route: '/sign-in', ...SOCIAL },
    auth: ['/dashboard', '/author'],
  },
};
for (const [k, v] of Object.entries(LIVE))
  APPS[k] = { ...(APPS[k] ?? { routes: ['/'], skipped: [] }), ...v };
