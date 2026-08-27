import { expect, test } from '@playwright/test';

test.describe('OAuth cookie session', () => {
  test('restores Forge from its own HttpOnly cookie session after the fake provider callback', async ({
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
    const sessionRedemptionResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === 'POST' &&
        url.origin === new URL(page.url()).origin &&
        url.pathname === '/api/oauth/callback/redeem'
      );
    });
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
    await popup.waitForURL(/\/oauth\/callback(?:\?|$)/);

    await page.waitForURL((url) => !url.pathname.endsWith('/login'));
    await expect.poll(() => popup.isClosed()).toBe(true);

    const setCookie = (await sessionRedemptionResponse).headerValue(
      'set-cookie'
    );
    expect(setCookie).toMatch(/ot_session=.*HttpOnly.*Path=\//i);
    expect(setCookie).not.toMatch(/\bDomain=/i);

    const forgeOrigin = new URL(page.url()).origin;
    expect(forgeOrigin).toBe('http://forgeofwill.localhost:8081');
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
    expect(
      (
        await context.cookies(
          'http://localhost:8080/api/authentication/session'
        )
      ).find((cookie) => cookie.name === 'ot_session')
    ).toBeUndefined();
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
    await expect(page).toHaveURL(/\/login$/);
  });
});
