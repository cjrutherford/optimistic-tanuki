import { expect, test } from '@playwright/test';

test.describe('OAuth cookie session', () => {
  test('uses the client-interface callback proxy and restores Forge from the shared HttpOnly session', async ({
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

    await popup.waitForURL(/127\.0\.0\.1:3016\/authorize/);
    expect(popup.isClosed()).toBe(false);
    await popup.waitForURL(/127\.0\.0\.1:8080\/oauth\/callback/);

    await page.waitForURL((url) => !url.pathname.endsWith('/login'));
    await expect.poll(() => popup.isClosed()).toBe(true);

    const sessionCookie = (await context.cookies('http://127.0.0.1:8081')).find(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(sessionCookie).toEqual(
      expect.objectContaining({ httpOnly: true, path: '/api' })
    );
    expect(
      await page.evaluate(() => localStorage.getItem('fow-client-authToken'))
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
