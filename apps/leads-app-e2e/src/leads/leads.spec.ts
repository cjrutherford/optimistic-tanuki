import { test, expect } from '@playwright/test';

test.describe('Leads App E2E', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:4200';

  test('redirects anonymous users to login', async ({ page }) => {
    await page.goto(baseURL);

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: 'Sign in to your leads workspace.' })
    ).toBeVisible();
    await expect(page.getByText('Lead Command')).toBeVisible();
  });

  test('shows unauthenticated navigation links', async ({ page }) => {
    await page.goto(baseURL);

    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Opportunity Compass' })
    ).toBeVisible();
  });

  test('loads the register route', async ({ page }) => {
    await page.goto(`${baseURL}/register`);

    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole('heading', { name: 'Create your account.' })
    ).toBeVisible();
    await expect(
      page.getByText(
        'Registration creates your Leads user account. The leads-specific profile setup happens after sign-in.'
      )
    ).toBeVisible();
  });
});
