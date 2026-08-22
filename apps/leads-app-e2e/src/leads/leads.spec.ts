import { test, expect } from '@playwright/test';

test.describe('Leads App E2E', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:4200';

  test('serves the landing page to anonymous users', async ({ page }) => {
    // Was asserting a /login redirect. `app.routes.ts` maps '' to
    // LandingComponent, so `/` has not redirected since the landing page
    // shipped — the assertion was stale, not the app broken.
    await page.goto(baseURL);

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Opportunities worth pursuing.' })
    ).toBeVisible();
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
