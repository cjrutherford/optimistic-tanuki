import { expect, test } from '@playwright/test';

test.describe('OAuth cookie session', () => {
  test('opens a popup, follows the provider redirect, and restores the opener from an HttpOnly session', async ({
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
    // The provider redirect target is the gateway endpoint, which
    // OAuthController.resolveProviderRedirectUri builds as
    // `<callbackBase>/api/oauth/callback/<provider>` whenever an app scope is
    // present. Without the `/api` prefix this matched nothing and the wait
    // burned the whole test budget, even though the flow itself completed —
    // the gateway logged a fully authenticated oauth-e2e@example.test.
    const callbackRequestPromise = context.waitForEvent(
      'request',
      (request) => {
        const url = new URL(request.url());
        return (
          url.origin === new URL(page.url()).origin &&
          url.pathname === '/api/oauth/callback/google'
        );
      }
    );
    const popupPromise = page.waitForEvent('popup');
    await google.click();
    const popup = await popupPromise;

    // A popup exists and remains open long enough to complete the external
    // provider redirect instead of being mistaken for a user cancellation.
    const providerRequest = await providerRequestPromise;
    expect(popup.isClosed()).toBe(false);
    expect(new URL(providerRequest.url()).origin).toBe('http://127.0.0.1:3016');
    const callbackRequest = await callbackRequestPromise;
    expect(new URL(callbackRequest.url()).origin).toBe(
      new URL(page.url()).origin
    );

    // The opener receives only a session-success signal, restores via the
    // protected session endpoint, and then completes the normal login route.
    await expect(page).toHaveURL(/\/(feed|settings)(?:\?|$)/);
    await expect.poll(() => popup.isClosed()).toBe(true);

    const appOrigin = new URL(page.url()).origin;
    const sessionCookie = (
      await context.cookies(`${appOrigin}/api/authentication/session`)
    ).find((cookie) => cookie.name === 'ot_session');
    expect(sessionCookie).toEqual(
      expect.objectContaining({ httpOnly: true, path: '/api' })
    );
    expect(sessionCookie?.value).toBeTruthy();
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
  });
});
