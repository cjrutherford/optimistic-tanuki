import { test, expect } from '@playwright/test';

// Opt in against the already-running development stack. No API interception.
test.skip(
  process.env['RR03_LIVE_STACK'] !== 'true',
  'Requires RR03_LIVE_STACK=true and the seeded development stack'
);
const apps = [
  { name: 'OT', origin: 'http://127.0.0.1:8080', protectedPath: '/settings' },
  // Distinct hostnames model production's host-only cookie boundary.
  { name: 'TS', origin: 'http://localhost:8087', protectedPath: '/account' },
];
const password = 'RR03-local-test-password!';
async function register(
  page: import('@playwright/test').Page,
  origin: string,
  email: string
) {
  await page.goto(origin + '/register');
  await page.getByLabel('First Name', { exact: true }).fill('RR03');
  await page.getByLabel('Last Name', { exact: true }).fill('Lifecycle');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/login$/);
}
async function login(
  page: import('@playwright/test').Page,
  origin: string,
  email: string
) {
  await page.goto(origin + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await expect
    .poll(async () =>
      (await page.request.get(origin + '/api/authentication/session')).status()
    )
    .toBe(200);
}
for (const app of apps) {
  test(`${app.name}: real registration, login, refresh, logout and revoked-cookie safety`, async ({
    page,
    context,
  }) => {
    const email = `rr03-${app.name.toLowerCase()}-${Date.now()}@example.test`;
    await register(page, app.origin, email);
    await login(page, app.origin, email);
    await page.goto(app.origin + app.protectedPath);
    await expect(page).toHaveURL(new RegExp(app.protectedPath + '$'));
    await expect(
      page.getByRole('heading', {
        name: app.name === 'OT' ? 'Settings' : 'My Account',
        exact: true,
      })
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(app.protectedPath + '$'));
    await expect(
      page.getByRole('heading', {
        name: app.name === 'OT' ? 'Settings' : 'My Account',
        exact: true,
      })
    ).toBeVisible();
    const cookies = (await context.cookies(app.origin)).filter(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(cookies).toHaveLength(1);
    expect(cookies[0].httpOnly).toBe(true);
    if (app.name === 'OT') {
      await page
        .locator('otui-app-bar button')
        .filter({ has: page.getByAltText('Optimistic Tanuki Logo') })
        .click();
      await page.getByRole('button', { name: 'Logout', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Log Out', exact: true }).click();
    }
    await expect
      .poll(async () =>
        (
          await page.request.get(app.origin + '/api/authentication/session')
        ).status()
      )
      .toBe(401);
    await context.addCookies(cookies);
    await page.goto(app.origin + app.protectedPath);
    await expect(page).toHaveURL(/\/login/);
    if (app.name === 'OT') {
      expect(
        await page.evaluate(() => [
          localStorage.getItem('ot-client-selectedProfile'),
          localStorage.getItem('ot-client-profiles'),
        ])
      ).toEqual([null, null]);
    }
  });
}
test('shared credentials require separate sign-ins on separate hosts', async ({
  page,
}) => {
  const email = `rr03-shared-${Date.now()}@example.test`;
  await register(page, apps[0].origin, email);
  await login(page, apps[0].origin, email);
  expect(
    (
      await page.request.get(apps[1].origin + '/api/authentication/session')
    ).status()
  ).toBe(401);
  await login(page, apps[1].origin, email);
  expect(
    (
      await page.request.get(apps[0].origin + '/api/authentication/session')
    ).status()
  ).toBe(200);
});
