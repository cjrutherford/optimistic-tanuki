import { expect, test } from '@playwright/test';

test.describe('OAuth cookie session', () => {
  test('opens a popup, follows the provider redirect, and restores the opener from an HttpOnly session', async ({
    page,
    context,
  }) => {
    const configResponse = page.waitForResponse((response) =>
      response.url().includes('/api/oauth/config')
    );
    await page.goto('/login');
    await expect((await configResponse).ok()).toBe(true);
    const google = page.getByLabel('Sign in with Google');
    await expect(google).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await google.click();
    const popup = await popupPromise;

    // A popup exists and remains open long enough to complete the external
    // provider redirect instead of being mistaken for a user cancellation.
    await popup.waitForURL(/127\.0\.0\.1:3016\/authorize/);
    expect(popup.isClosed()).toBe(false);
    await popup.waitForURL(/\/oauth\/callback(?:\?|\/)/);

    // The opener receives only a session-success signal, restores via the
    // protected session endpoint, and then completes the normal login route.
    await expect(page).toHaveURL(/\/(feed|settings)(?:\?|$)/);
    await expect.poll(() => popup.isClosed()).toBe(true);

    const sessionCookie = (await context.cookies('http://127.0.0.1:8080')).find(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(sessionCookie).toEqual(
      expect.objectContaining({ httpOnly: true, path: '/api' })
    );
    expect(sessionCookie?.value).toBeTruthy();
    expect(
      await page.evaluate(() => localStorage.getItem('ot-client-authToken'))
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
