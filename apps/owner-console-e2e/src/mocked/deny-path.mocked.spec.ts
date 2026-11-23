import { expect, test } from '@playwright/test';
import { signInThroughForm } from '../support/nav';
import { installApiMocks } from './fixtures';

test.describe('Owner console deny paths (mocked API)', () => {
  test('a signed-in account with no owner role lands on no access', async ({
    page,
  }) => {
    await installApiMocks(page, { roles: [] });
    await signInThroughForm(page, 'plain@example.test', 'irrelevant');
    await expect(page).toHaveURL(/\/no-access/);
    await expect(
      page.getByRole('heading', { name: /don't have access/i })
    ).toBeVisible();
  });

  test('an anonymous visitor is sent from the dashboard to login', async ({
    page,
  }) => {
    await installApiMocks(page);
    await page.goto('/dashboard/home');
    await expect(page).toHaveURL(/\/login/);
  });
});
