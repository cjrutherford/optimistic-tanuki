import { expect, test } from '@playwright/test';
import { waitForHydration } from '../../../e2e/wait-for-hydration';

test.describe('OAuth cookie session', () => {
  test('uses the shared client-interface callback proxy and restores Fin Commander', async ({
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
    const popupPromise = page.waitForEvent('popup');
    await google.click();
    const popup = await popupPromise;

    await popup.waitForURL(/127\.0\.0\.1:3016\/authorize/);
    expect(popup.isClosed()).toBe(false);
    await popup.waitForURL(/127\.0\.0\.1:8080\/oauth\/callback/);
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
