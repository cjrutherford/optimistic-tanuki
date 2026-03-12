import { test, expect } from '@playwright/test';

test.describe('Local Hub E2E Tests', () => {
  test.describe('Landing Page', () => {
    test('should load the landing page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display Browse Communities button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      // The landing page has a "Browse Communities" button visible to anonymous users
      const browseButton = page.getByText('Browse Communities');
      await expect(browseButton).toBeVisible();
    });
  });

  test.describe('Communities Page', () => {
    test('should be accessible without login', async ({ page }) => {
      await page.goto('/communities');
      await page.waitForLoadState('domcontentloaded');
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Authentication Pages', () => {
    test('should display login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      expect(url.includes('login')).toBe(true);
    });

    test('should display register page', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      expect(url.includes('register')).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });
});
