import { expect, test } from '@playwright/test';

test.describe('OAuth cookie session', () => {
  test('completes the gateway callback on its own origin and restores Digital Homestead', async ({
    page,
    context,
  }) => {
    // The login page requests /api/oauth/config in its constructor, but these
    // apps enable provideClientHydration(), which turns on Angular's HTTP
    // transfer cache. The request is therefore issued during SSR and replayed
    // from TransferState on the client, so the browser never puts it on the
    // wire and waiting for the response here always timed out. Assert on the
    // observable result instead: the provider button only renders once the
    // config has been applied.
    await page.goto('/login');

    const google = page.getByLabel('Sign in with Google');
    await expect(google).toBeVisible();
    const popupPromise = page.waitForEvent('popup');
    const providerRequest = context.waitForEvent('request', (request) =>
      request.url().startsWith('http://127.0.0.1:3016/authorize')
    );
    // The callback lands on Digital Homestead's own origin, not on the Client
    // Interface proxy. OAuthController.resolveCallbackBase() returns the app's
    // registered origin whenever the app scope is known, and falls back to the
    // Client Interface base only for a scope it cannot place; digital-homestead
    // is registered, so it never took that fallback.
    const gatewayCallbackRequest = context.waitForEvent('request', (request) =>
      request.url().startsWith('http://127.0.0.1:8082/api/oauth/callback/')
    );
    const redemptionResponse = context.waitForEvent('response', (response) =>
      response
        .url()
        .startsWith('http://127.0.0.1:8082/api/oauth/callback/redeem')
    );
    await google.click();
    const popup = await popupPromise;

    expect(popup.isClosed()).toBe(false);
    await providerRequest;
    await gatewayCallbackRequest;
    await expect((await redemptionResponse).ok()).toBe(true);

    await expect(page).toHaveURL(/\/blog(?:\?|$)/, { timeout: 10_000 });
    await expect.poll(() => popup.isClosed()).toBe(true);

    const sessionCookie = (await context.cookies('http://127.0.0.1:8082')).find(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(sessionCookie).toEqual(
      // The gateway sets this cookie at path '/', in both
      // OAuthController's redeem handler and
      // AuthenticationController.browserSessionCookieOptions(). '/api'
      // was never a path it emits.
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
    expect(
      await page.evaluate(() => localStorage.getItem('dh-client-authToken'))
    ).toBeNull();

    const session = await page.request.get('/api/authentication/session');
    expect(session.ok()).toBe(true);
    await expect(session.json()).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'oauth-e2e@example.test' }),
      })
    );
  });
});
