import { expect, test } from '@playwright/test';
import { waitForHydration } from '../../../e2e/wait-for-hydration';

test.describe('OAuth cookie session', () => {
  test('restores Forge from its own HttpOnly cookie session after the fake provider callback', async ({
    page,
    context,
    baseURL,
  }) => {
    // The login page requests /api/oauth/config in its constructor, but these
    // apps enable provideClientHydration(), which turns on Angular's HTTP
    // transfer cache. The request is therefore issued during SSR and replayed
    // from TransferState on the client, so the browser never puts it on the
    // wire and waiting for the response here always timed out. Assert on the
    // observable result instead: the provider button only renders once the
    // config has been applied.
    await page.goto('/login');
    await waitForHydration(page);

    const google = page.getByLabel('Sign in with Google');
    await expect(google).toBeVisible();
    const providerRequestPromise = context.waitForEvent(
      'request',
      (request) => {
        const url = new URL(request.url());
        return (
          url.origin === 'http://127.0.0.1:3016' &&
          url.pathname === '/authorize'
        );
      }
    );
    const gatewayCallbackRequestPromise = context.waitForEvent(
      'request',
      (request) => {
        const url = new URL(request.url());
        return (
          url.origin === new URL(page.url()).origin &&
          url.pathname === '/api/oauth/callback/google'
        );
      }
    );
    // Context-wide, not `page.waitForResponse`, so the wait does not depend on
    // which page redeems. The callback popup now posts the one-time code back
    // to this page, which redeems it. Before the gateway stopped severing
    // window.opener, the popup redeemed it itself, and a page-scoped wait on
    // the opener saw nothing.
    const sessionRedemptionResponse = context.waitForEvent(
      'response',
      (response) => {
        const url = new URL(response.url());
        return (
          response.request().method() === 'POST' &&
          url.origin === new URL(baseURL as string).origin &&
          url.pathname === '/api/oauth/callback/redeem'
        );
      }
    );
    const popupPromise = page.waitForEvent('popup');
    await google.click();
    const popup = await popupPromise;

    const providerRequest = await providerRequestPromise;
    expect(popup.isClosed()).toBe(false);
    expect(new URL(providerRequest.url()).origin).toBe('http://127.0.0.1:3016');
    const gatewayCallbackRequest = await gatewayCallbackRequestPromise;
    expect(new URL(gatewayCallbackRequest.url()).origin).toBe(
      new URL(page.url()).origin
    );
    // No `popup.waitForURL(/oauth/callback/)` here. The popup reaches the
    // callback page, posts the code to this page and closes about a second
    // later, so waiting on its URL now races a closed page ("Target page,
    // context or browser has been closed").
    //
    // The redeem is posted by this page, which stays open, so `headerValue()`
    // can still reach the request's page. (`headerValue()` is itself async —
    // the single await used to bind to the response, leaving a Promise to be
    // matched against a regex.)
    const setCookie = await (
      await sessionRedemptionResponse
    ).headerValue('set-cookie');
    // Assert the attributes independently. The old pattern required HttpOnly
    // to appear before Path, and Express emits them the other way round:
    // `ot_session=...; Max-Age=3600; Path=/; Expires=...; HttpOnly; SameSite=Lax`.
    // Set-Cookie attributes are unordered, so pinning a sequence tested the
    // serialiser rather than the policy.
    expect(setCookie).toMatch(/^ot_session=/);
    expect(setCookie).toMatch(/;\s*Path=\/(;|$)/i);
    expect(setCookie).toMatch(/;\s*HttpOnly(;|$)/i);
    expect(setCookie).not.toMatch(/\bDomain=/i);

    await page.waitForURL((url) => !url.pathname.endsWith('/login'));
    await expect.poll(() => popup.isClosed()).toBe(true);

    const forgeOrigin = new URL(page.url()).origin;
    // Pinned to the vhost origin of the standalone forgeofwill composition,
    // which CI does not use — it drives the loopback origin the manifest
    // declares. Assert against the origin this run was actually configured
    // with so the property holds in either stack.
    expect(forgeOrigin).toBe(new URL(baseURL as string).origin);
    const sessionCookie = (
      await context.cookies(`${forgeOrigin}/api/authentication/session`)
    ).find((cookie) => cookie.name === 'ot_session');
    expect(sessionCookie).toEqual(
      expect.objectContaining({
        domain: new URL(forgeOrigin).hostname,
        httpOnly: true,
        path: '/',
      })
    );
    // No cross-origin check here: cookies are not isolated by port, so a
    // host-only cookie for 127.0.0.1 is sent to every port on that host, and
    // in this stack Forge and the Client Interface differ only by port. The
    // standalone forgeofwill composition gave them distinct hostnames
    // (forgeofwill.localhost against localhost) and the separation held there.
    // The property that does hold, and that actually limits the cookie to one
    // host, is the absent Domain attribute asserted above.
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) => /token/i.test(key))
      )
    ).toEqual([]);

    const session = await page.request.get('/api/authentication/session');
    expect(session.ok()).toBe(true);
    await expect(session.json()).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'oauth-e2e@example.test' }),
      })
    );

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings$/);

    await page.reload();
    await expect(page).toHaveURL(/\/settings$/);

    await context.addCookies([
      {
        name: 'ot_session',
        value: 'invalid-cookie-session',
        domain: new URL(forgeOrigin).hostname,
        path: '/',
      },
    ]);
    await page.reload();
    // The SSR route guard (apps/forgeofwill/src/server-route-guard.ts) keeps the
    // page the user was on as `returnUrl`, so a rejected session on /settings
    // lands on login ready to send them back. `/\/login$/` predates that and
    // was never reached in CI while the popup assertions above were failing.
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fsettings$/);
  });
});
