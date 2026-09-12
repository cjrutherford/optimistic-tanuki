import { expect, test } from '@playwright/test';
import { waitForHydration } from '../../../e2e/wait-for-hydration';

test.describe('OAuth cookie session', () => {
  test('completes the gateway callback on its own origin and restores Fin Commander', async ({
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
    await waitForHydration(page);

    const google = page.getByLabel('Sign in with Google');
    await expect(google).toBeVisible();

    // Registered before the click, and against request events rather than the
    // popup's current URL. `popup.waitForURL` only matches from the moment it
    // is called, and the popup races through the provider redirect to the
    // callback in milliseconds, so waiting on it after `await popupPromise`
    // could miss the hop entirely. Request events cannot be missed.
    const providerRequest = context.waitForEvent('request', (request) =>
      request.url().startsWith('http://127.0.0.1:3016/authorize')
    );
    // The callback lands on Fin Commander's own origin. This app asks the
    // gateway for the `finance` app scope rather than `fin-commander`, and
    // APP_SCOPE_ORIGINS now keys its origin under `finance` to match, so
    // resolveCallbackBase('finance') returns http://127.0.0.1:8089 instead of
    // falling through to the Client Interface base.
    const gatewayCallbackRequest = context.waitForEvent('request', (request) =>
      request.url().startsWith('http://127.0.0.1:8089/api/oauth/callback/')
    );
    const popupPromise = page.waitForEvent('popup');
    await google.click();
    const popup = await popupPromise;

    await providerRequest;
    await gatewayCallbackRequest;
    await expect.poll(() => popup.isClosed()).toBe(true);

    const sessionCookie = (await context.cookies('http://127.0.0.1:8089')).find(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(sessionCookie).toEqual(
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
    expect(
      await page.evaluate(() =>
        localStorage.getItem('fin-commander-auth-authToken')
      )
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
