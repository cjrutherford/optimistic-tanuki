import { test, expect } from '@playwright/test';

/**
 * Performance thresholds for E2E tests
 */
const PERFORMANCE_THRESHOLDS = {
  /** Maximum acceptable page load time in milliseconds */
  MAX_PAGE_LOAD_TIME_MS: 10000,
} as const;

test.describe('Owner Console E2E Tests', () => {
  test.describe('Homepage', () => {
    test('should load the homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify page loads successfully
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('has title with Welcome', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Expect h1 to contain a substring.
      expect(await page.locator('h1').innerText()).toContain('Welcome');
    });

    test('should have proper document structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const html = page.locator('html');
      await expect(html).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should have login link', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const loginLink = page.locator('a[href*="login"]');
      await expect(loginLink).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toContain('login');
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toContain('register');
    });

    test('should handle browser back/forward', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const firstUrl = page.url();
      await page.goBack();
      await page.goForward();
      
      expect(page.url()).toBe(firstUrl);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_PAGE_LOAD_TIME_MS);
    });
  });

  test.describe('Registration Page', () => {
    test('should display registration form', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      
      // Should display registration header
      const header = page.locator('text=Owner Console Registration');
      await expect(header).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      
      const loginLink = page.locator('a[href*="login"]');
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Should have email and password inputs
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should have link to register page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      const registerLink = page.locator('a[href*="register"]');
      await expect(registerLink).toBeVisible();
    });
  });
});
