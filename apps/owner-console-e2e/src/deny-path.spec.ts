import { expect, test } from '@playwright/test';
import { signInThroughForm } from './support/nav';

const gatewayUrl = process.env['GATEWAY_URL'] ?? 'http://127.0.0.1:3000';

test.describe('Owner console deny paths (full stack)', () => {
  test('sends anonymous visitors from /dashboard/home to login', async ({
    page,
  }) => {
    await page.goto('/dashboard/home');
    await expect(page).toHaveURL(/\/login/);
  });

  test('sends anonymous visitors from /control-center to login', async ({
    page,
  }) => {
    await page.goto('/control-center');
    await expect(page).toHaveURL(/\/login/);
  });

  test('refuses the anonymous status endpoint', async ({ request }) => {
    const response = await request.get('/admin-api/api/status/public');
    expect([401, 403]).toContain(response.status());
  });

  test('a signed-in account without an owner role lands on no access', async ({
    page,
    request,
  }) => {
    // Register a plain account straight at the gateway under another app
    // scope: the console's own proxy stamps the owner-console scope, which
    // would refuse the registration.
    const email = `deny-path-${Date.now()}@example.test`;
    const password = 'TestPassword123!';
    const registration = await request.post(
      `${gatewayUrl}/api/authentication/register`,
      {
        headers: {
          'X-ot-app-id': 'client-interface',
          'X-ot-appscope': 'client-interface',
          Origin: 'http://127.0.0.1:8080',
          Host: '127.0.0.1:8080',
        },
        data: {
          email,
          password,
          confirm: password,
          fn: 'Deny',
          ln: 'Path',
          dateOfBirth: '1990-01-01',
          bio: 'Owner console deny-path participant',
        },
      }
    );
    test.skip(
      registration.status() !== 201,
      `a plain account could not be registered (status ${registration.status()})`
    );

    await signInThroughForm(page, email, password);
    await expect(page).toHaveURL(/\/no-access/);
    await expect(
      page.getByRole('heading', { name: /don't have access/i })
    ).toBeVisible();
  });
});
