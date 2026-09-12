import { test, expect } from '@playwright/test';

test.describe('Owner Console E2E Tests', () => {
  test.describe('Homepage & Authentication Redirect', () => {
    // The root no longer bounces anonymous visitors to /login. app.routes.ts
    // redirects '' to '/control-center', which loads
    // PublicControlCenterComponent — deliberately unguarded, described in its
    // own copy as "This login-free view is intended for internal network
    // access". The guarded surface is /dashboard, which is asserted below.
    test('lands anonymous visitors on the login-free control center', async ({
      page,
    }) => {
      await page.goto('/');

      await expect(page).toHaveURL(/\/control-center$/);
      await expect(
        page.getByRole('heading', { name: 'Platform control center' })
      ).toBeVisible();
    });

    test('sends an unauthenticated visitor from the dashboard to login', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveURL(/.*login/);
    });

    test('should have proper document structure', async ({ page }) => {
      await page.goto('/login');

      const html = page.locator('html');
      await expect(html).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('does not expose public owner registration on the login page', async ({
      page,
    }) => {
      await page.goto('/login');

      const registerLink = page.locator('a[href*="register"]');
      await expect(registerLink).toHaveCount(0);
    });

    test('redirects the legacy registration route to provisioning guidance', async ({
      page,
    }) => {
      await page.goto('/register');

      await expect(page).toHaveURL(/\/login\?provisioning=required/);
      // The login page renders two `role="status"` regions: this one and the
      // OAuth notice. This suite's stack has no oauth-provider, so the OAuth
      // notice is always present and a bare getByRole('status') trips strict
      // mode. Select the provisioning message specifically.
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: 'Owner accounts must be provisioned' })
      ).toContainText(
        'Owner accounts must be provisioned by an existing operator.'
      );
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');

      await expect(
        page.getByRole('heading', { name: /platform-wide authority/i })
      ).toBeVisible();
      const widths = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(widths.document).toBeLessThanOrEqual(widths.viewport);
      expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    });
  });

  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      // Should have email and password inputs (via custom components)
      const emailInput = page
        .locator('input[type="text"], input[type="email"]')
        .first();
      const passwordInput = page.locator('input[type="password"]');

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    });
  });
});
