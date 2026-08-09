import { expect, test } from '@playwright/test';
import { createAuthenticatedSession } from './helpers/local-hub-api';
import { getBaseUrl } from './fixtures/helpers';

test.describe('Cookie-backed SSR protected reloads', () => {
  test('renders and reloads an account page from a real HttpOnly session cookie', async ({
    context,
    page,
  }) => {
    await createAuthenticatedSession(context.request, {
      withBrowserCookie: true,
    });

    const sessionCookie = (await context.cookies()).find(
      (cookie) =>
        cookie.name === 'ot_session' &&
        cookie.path === '/' &&
        cookie.domain === new URL(getBaseUrl()).hostname
    );
    expect(sessionCookie).toMatchObject({
      domain: new URL(getBaseUrl()).hostname,
      httpOnly: true,
      path: '/',
    });

    await page.goto('/account');
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole('heading', { name: 'My Account' })
    ).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole('heading', { name: 'My Account' })
    ).toBeVisible();
  });

  test('redirects a forged cookie away from a protected SSR deep link', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'ot_session',
        value: 'forged-session-token',
        url: getBaseUrl(),
        httpOnly: true,
      },
    ]);

    await page.goto('/account?tab=profile');
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  });
});
