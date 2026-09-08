import { expect, test } from '@playwright/test';

test.describe('OAuth cookie session', () => {
  test('uses the Client Interface callback proxy and restores Digital Homestead', async ({
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
    const proxyCallbackRequest = context.waitForEvent('request', (request) =>
      request.url().startsWith('http://127.0.0.1:8080/oauth/callback/')
    );
    const redemptionResponse = context.waitForEvent('response', (response) =>
      response
        .url()
        .startsWith('http://127.0.0.1:8080/api/oauth/callback/redeem')
    );
    await google.click();
    const popup = await popupPromise;

    expect(popup.isClosed()).toBe(false);
    await providerRequest;
    await proxyCallbackRequest;
    await expect((await redemptionResponse).ok()).toBe(true);

    await expect(page).toHaveURL(/\/blog(?:\?|$)/, { timeout: 10_000 });
    await expect.poll(() => popup.isClosed()).toBe(true);

    const sessionCookie = (await context.cookies('http://127.0.0.1:8082')).find(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(sessionCookie).toEqual(
      expect.objectContaining({ httpOnly: true, path: '/api' })
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
