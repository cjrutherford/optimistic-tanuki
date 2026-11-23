import { Page, Route } from '@playwright/test';

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
   * segment, answered with 200. Anything unlisted keeps the 503 default.
   */
  operations?: Record<string, unknown>;
}

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
      if (options.operations && name in options.operations) {
        return json(route, options.operations[name]);
      }
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
    return json(route, { message: 'not stubbed' }, 503);
  });
}
