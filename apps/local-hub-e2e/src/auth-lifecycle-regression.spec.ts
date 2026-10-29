import { test, expect } from '@playwright/test';

// Contract fixtures exercise actual forms/state code; they are not backend or
// real-account acceptance. Authentication service E2E is run separately.
const apps = [
  { name: 'OT', origin: process.env['OT_BASE_URL'] || 'http://127.0.0.1:8080' },
  { name: 'TS', origin: process.env['TS_BASE_URL'] || 'http://127.0.0.1:8087' },
];
for (const app of apps) {
  test(`${app.name}: offers only server-configured OAuth providers`, async ({
    page,
  }) => {
    await page.route('**/api/oauth/config', (route) =>
      route.fulfill({
        json: {
          google: {
            enabled: true,
            clientId: 'rr03-test-client',
            redirectUri: app.origin + '/api/oauth/callback/google',
          },
        },
      })
    );
    await page.goto(app.origin + '/login');
    await expect(page.getByLabel('Sign in with Google')).toBeVisible();
    await expect(page.getByLabel('Sign in with GitHub')).toHaveCount(0);
    await expect(page.getByLabel('Sign in with Microsoft')).toHaveCount(0);
    await expect(page.getByLabel('Sign in with Facebook')).toHaveCount(0);
  });

  test(`${app.name}: rejected registration shows an error without logging form secrets`, async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));
    await page.route('**/api/authentication/register', (route) =>
      route.fulfill({
        status: 409,
        json: { message: 'Email already registered' },
      })
    );
    await page.goto(app.origin + '/register');
    const dateOfBirth = page.getByLabel('Date of birth');
    if (await dateOfBirth.isVisible()) {
      await dateOfBirth.fill('1990-01-01');
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    await page.getByLabel('First Name', { exact: true }).fill('RR03');
    await page.getByLabel('Last Name', { exact: true }).fill('Test');
    await page.getByLabel('Email', { exact: true }).fill('rr03@example.test');
    await page
      .getByLabel('Password', { exact: true })
      .fill('RR03-test-only-password!');
    await page
      .getByLabel('Confirm Password', { exact: true })
      .fill('RR03-test-only-password!');
    await page.locator('form button[type="submit"]').click();
    await expect(
      page
        .locator('.auth-error, .error-message')
        .filter({ hasText: /registered|Registration failed/ })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    expect(logs.some((log) => log.includes('RR03-test-only-password!'))).toBe(
      false
    );
  });
  test(`${app.name}: invalid login is visible and does not log a password`, async ({
    page,
  }) => {
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));
    await page.route('**/api/authentication/session', (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );
    await page.route('**/api/authentication/login', (route) =>
      route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
    );
    await page.goto(app.origin + '/login');
    await page.getByLabel('Email', { exact: true }).fill('rr03@example.test');
    await page
      .getByLabel('Password', { exact: true })
      .fill('RR03-test-only-password!');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /Invalid email or password/ })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(logs.some((log) => log.includes('RR03-test-only-password!'))).toBe(
      false
    );
  });
  test(`${app.name}: missing cookie after login leaves a visible failure`, async ({
    page,
  }) => {
    await page.route('**/api/authentication/session', (route) =>
      route.fulfill({ status: 401, json: {} })
    );
    await page.route('**/api/authentication/login', (route) =>
      route.fulfill({ json: { data: {} } })
    );
    await page.goto(app.origin + '/login');
    await page.getByLabel('Email', { exact: true }).fill('rr03@example.test');
    await page
      .getByLabel('Password', { exact: true })
      .fill('RR03-test-only-password!');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /Sign-in|Invalid email/ })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
}
test('OT: expired session removes saved identity before protected routing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'ot-client-selectedProfile',
      JSON.stringify({
        id: 'old-profile',
        userId: 'old-user',
        profileName: 'Previous account',
      })
    );
    localStorage.setItem(
      'ot-client-profiles',
      JSON.stringify([{ id: 'old-profile', userId: 'old-user' }])
    );
  });
  await page.route('**/api/authentication/session', (route) =>
    route.fulfill({ status: 401, json: {} })
  );
  await page.goto(apps[0].origin + '/feed');
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => [
      localStorage.getItem('ot-client-selectedProfile'),
      localStorage.getItem('ot-client-profiles'),
    ])
  ).toEqual([null, null]);
  await expect(page.locator('body')).not.toContainText('Previous account');
});
