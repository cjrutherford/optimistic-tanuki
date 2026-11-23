import { expect, Page, Route, test as base } from '@playwright/test';

export const MOCK_TOWN = {
  id: 'town-1',
  name: 'Testville',
  city: 'Testville',
  adminArea: 'TS',
  localityType: 'city',
};

export interface ApiMockOptions {
  /** Roles returned for the account; an empty list is a non-owner. */
  roles?: Array<{ role: { name: string } }>;
  /** Attention items; null makes `/api/owner/attention` answer 503. */
  attention?: Array<Record<string, unknown>> | null;
  /**
   * Communities returned by `/api/communities` (which also backs the cities
   * list and the town switcher); null makes it answer 503.
   */
  communities?: Array<Record<string, unknown>> | null;
  /**
   * Bodies for `/api/local-hub/operations/<name>` keyed by the last path
   * segment, answered with 200; anything unlisted gets a healthy empty
   * reply. null makes every operation answer 503.
   */
  operations?: Record<string, unknown> | null;
}

/**
 * Healthy, empty answers for every list a page loads, in the shape the
 * gateway returns. They keep each page on its own empty state; a page that
 * calls an endpoint missing from here gets a 503, which the console guard
 * reports as an unstubbed call.
 */
const HEALTHY_GETS: Record<string, unknown> = {
  '/api/app-config': [],
  '/api/profile': [],
  '/api/permissions/role': [],
  '/api/permissions/app-scope': [],
  '/api/permissions/permission': [],
  '/api/store/products': [],
  '/api/store/orders': [],
  '/api/store/subscriptions': [],
  '/api/donations': [],
  '/api/store/appointments': [],
  '/api/store/availabilities': [],
  '/api/store/resources': [],
  '/api/contact/leads': [],
  '/api/contact/hai/leads': [],
  '/api/privacy/admin/reports': [],
  '/api/forum/admin/reports': [],
  '/api/forum/topics': [],
  '/api/forum/threads': [],
  '/api/forum/posts': [],
  '/api/business/site-config': { configId: null, config: null },
  '/api/hardware/operator/supplier-offers': [],
  '/api/security/events': { events: [] },
  '/api/security/metrics': {
    totals: {
      requests: 0,
      denied: 0,
      rateLimited: 0,
      blocked: 0,
      errors: 0,
      serverErrors: 0,
    },
    series: [],
    topPaths: [],
    topHosts: [],
  },
  '/api/directory/runs': { runs: [], total: 0 },
  '/api/directory/runs/budget': {
    period: '2026-11',
    ceilingCents: 0,
    reservedCents: 0,
    usedCents: 0,
    remainingCents: 0,
    anonymousAttempts: 0,
    hardStop: false,
    acquisitionAuthorized: false,
  },
  '/api/directory/runs/releases': {
    active: { release: 'none', source: 'pinned' },
    candidates: [],
  },
  '/api/directory/taxonomy/cases': { cases: [], total: 0 },
  '/api/directory/taxonomy/mappings': { versions: [], available: [] },
  '/api/directory/taxonomy/runs': { runs: [], total: 0 },
  '/api/directory/reviewed-bindings': {
    bindings: [],
    total: 0,
    nextCursor: null,
  },
  '/api/directory/rights-cases': { cases: [], total: 0 },
  '/api/directory/withdrawals': { requests: [], total: 0 },
  '/api/directory/exports': { items: [], total: 0 },
  '/api/directory/operations/controls': { controls: [] },
  '/api/directory/operations/metrics': {
    generatedAt: '2026-11-23T00:00:00.000Z',
    infrastructure: null,
    towns: null,
    coverage: null,
    freshness: null,
    policy: null,
    spend: null,
    queues: null,
    controls: [],
    errors: [],
  },
  '/api/registry/apps': {
    success: true,
    data: { version: 1, generatedAt: '2026-11-23T00:00:00.000Z', apps: [] },
  },
  '/api/registry/links': { success: true, data: [] },
  '/api/registry/drift': {
    success: true,
    data: {
      state: 'in-sync',
      sourceHash: 'stub',
      publishedHash: 'stub',
      publishedVersion: 1,
      changedApps: [],
      addedInDatabase: [],
      missingFromDatabase: [],
      hasUnpublishedChanges: false,
    },
  },
  '/api/registry/audit-log': { success: true, data: [] },
  '/admin-api/api/status/public': {
    deploymentName: 'optimistic-tanuki',
    namespace: 'production',
    provider: 'compose',
    defaultTag: 'latest',
    serviceCount: 0,
    appCount: 0,
    publicHosts: [],
    oauthEnabled: false,
    oauthProviders: 0,
  },
  '/admin-api/api/rollouts/preview': {
    deploymentName: 'optimistic-tanuki',
    currentTag: 'latest',
    targetTag: 'latest',
    strategy: 'rolling',
    batchSize: 1,
    services: [],
    waves: [],
  },
  '/admin-api/api/rollouts/history': [],
  '/admin-api/api/rollouts/latest': { status: 'pending' },
  '/admin-api/api/oauth/providers': { providers: [] },
  '/admin-api/api/deployment/health': {
    configStatus: 'current',
    infrastructure: 'compose-up',
    databaseReadiness: 'all-slots-ready',
    secretsHealth: 'all-keys-present',
  },
  '/admin-api/api/deployment/images': [],
  '/api/performance/summary': [],
  '/api/performance/alerts': [],
  '/api/performance/runtime': [],
  '/api/videos/processing/overview': {
    totals: { pending: 0, processing: 0, ready: 0, failed: 0 },
    jobs: [],
  },
};

/** Healthy empty replies for `/api/local-hub/operations/<name>`. */
const HEALTHY_OPERATIONS: Record<string, unknown> = {
  'pipeline-health': { data: { towns: [] } },
  'official-candidates': { data: [] },
  backfill: { data: null },
  density: { data: { rows: [] } },
  'takedown-notices': { data: [] },
  'source-requests': { data: { items: [], total: 0 } },
};

/** The same, for paths that carry an id. */
const HEALTHY_PATTERNS: Array<[RegExp, unknown]> = [
  [
    /^\/api\/directory\/towns\/[^/]+\/duplicate-cases$/,
    { cases: [], total: 0 },
  ],
  [
    /^\/api\/directory\/towns\/[^/]+\/listing-reports$/,
    { reports: [], total: 0 },
  ],
  [
    /^\/api\/directory\/towns\/[^/]+\/business-link-requests$/,
    { requests: [], nextCursor: null },
  ],
  [/^\/api\/social\/community\/[^/]+\/members$/, []],
  // The gateway answers null when a community has no elected manager.
  [/^\/api\/communities\/[^/]+\/manager$/, null],
];

/** Calls the stub did not know, per page, for the console guard to report. */
export const unstubbedByPage = new WeakMap<Page, string[]>();

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

/**
 * Stub the gateway the console talks to. The session starts signed out and
 * becomes valid once the login call has been made, as the real cookie would.
 * Anything not listed answers 503 so a page shows "Unavailable" rather than
 * an empty list that looks healthy.
 */
export async function installApiMocks(
  page: Page,
  options: ApiMockOptions = {}
): Promise<void> {
  const roles = options.roles ?? [{ role: { name: 'owner_console_owner' } }];
  const attention = options.attention === undefined ? [] : options.attention;
  const communities =
    options.communities === undefined ? [MOCK_TOWN] : options.communities;
  let signedIn = false;
  const unstubbed: string[] = [];
  unstubbedByPage.set(page, unstubbed);

  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/authentication/login' && method === 'POST') {
      signedIn = true;
      return json(route, { data: { userId: 'u1' } }, 201);
    }
    if (path === '/api/authentication/session') {
      return signedIn
        ? json(route, {
            data: {
              userId: 'u1',
              profileId: 'p1',
              email: 'owner@example.test',
              name: 'Owner',
            },
          })
        : json(route, { message: 'Unauthorized' }, 401);
    }
    if (path === '/api/authentication/logout') {
      signedIn = false;
      return json(route, {});
    }
    if (path === '/api/oauth/config') {
      return json(route, { providers: [] });
    }
    if (path.startsWith('/api/permissions/user-roles/')) {
      return json(route, roles);
    }
    if (path === '/api/communities') {
      return communities === null
        ? json(route, { message: 'unavailable' }, 503)
        : json(route, communities);
    }
    if (path.startsWith('/api/local-hub/operations/')) {
      const name = path.slice(path.lastIndexOf('/') + 1);
      if (options.operations === null) {
        return json(route, { message: 'unavailable' }, 503);
      }
      const body = options.operations?.[name] ?? HEALTHY_OPERATIONS[name];
      if (body !== undefined) return json(route, body);
    }
    if (path === '/api/owner/attention') {
      return attention === null
        ? json(route, { message: 'unavailable' }, 503)
        : json(route, {
            generatedAt: new Date().toISOString(),
            items: attention,
          });
    }
    if (path === '/api/owner/health') {
      return json(route, []);
    }
    if (method === 'GET') {
      const exact = HEALTHY_GETS[path];
      if (exact !== undefined) return json(route, exact);
      const match = HEALTHY_PATTERNS.find(([pattern]) => pattern.test(path));
      if (match) return json(route, match[1]);
    }
    // Fire-and-forget telemetry the console posts about itself.
    if (path === '/api/performance/rum' && method === 'POST') {
      return json(route, {}, 202);
    }
    unstubbed.push(`${method} ${path}`);
    return json(route, { message: 'not stubbed' }, 503);
  });
}

/**
 * Lets one test name the console errors it provokes on purpose (a stub that
 * answers 503 so a page shows Unavailable, say). Nothing is allowed unless a
 * test asks, and each entry should say why.
 */
export interface ConsoleGuard {
  allow(...patterns: RegExp[]): void;
}

/**
 * `test` for the mocked suite. An auto fixture watches every page the test
 * opens and fails it, once the body is done, on any uncaught page error, any
 * console.error, or any /api call the stub does not cover. Specs import this
 * instead of `@playwright/test`'s own `test`, so no mocked test can skip it.
 */
export const test = base.extend<{ consoleGuard: ConsoleGuard }>({
  consoleGuard: [
    async ({ page }, use) => {
      const allowed: RegExp[] = [];
      const problems: string[] = [];
      page.on('pageerror', (error) =>
        problems.push(`pageerror: ${error.message}`)
      );
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        const url = message.location().url;
        // Browsers ask for /favicon.ico on their own; the console ships none.
        if (/\/favicon\.ico$/.test(url)) return;
        // Every signed-out visit probes the session first and gets a 401: that
        // is the sign-in redirect working, and the browser logs it.
        if (
          /status of 401/.test(text) &&
          new URL(url).pathname === '/api/authentication/session'
        ) {
          return;
        }
        if (allowed.some((pattern) => pattern.test(text))) return;
        problems.push(
          `console.error on ${new URL(page.url()).pathname}: ${text} (${url})`
        );
      });

      await use({ allow: (...patterns) => allowed.push(...patterns) });

      expect.soft(problems, 'unexpected console errors').toEqual([]);
      expect
        .soft(
          unstubbedByPage.get(page) ?? [],
          'API calls the mock does not stub'
        )
        .toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
