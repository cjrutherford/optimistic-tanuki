import { test, expect } from '@playwright/test';

test.describe('Owner Console E2E Tests', () => {
  test.describe('Homepage & Authentication Redirect', () => {
    test('should redirect to login when not authenticated', async ({
      page,
    }) => {
      await page.goto('/');

      // Should redirect to /login
      await expect(page).toHaveURL(/.*login/);

      // Verify login page content
      const title = page.locator('h1');
      await expect(title).toContainText('Owner Console');
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
      await expect(page.getByRole('status')).toContainText(
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
