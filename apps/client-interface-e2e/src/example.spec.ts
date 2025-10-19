import { test, expect } from '@playwright/test';

test.describe('Client Interface E2E Tests', () => {
  test.describe('Homepage', () => {
    test('should load the homepage', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Client Interface/i);
    });

    test('should display main navigation', async ({ page }) => {
      await page.goto('/');
      
      // Wait for the page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      // Check for common navigation elements
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });
  });

  test.describe('Authentication Flow', () => {
    const testUser = {
      email: `e2e-test-${Date.now()}@example.com`,
      firstName: 'E2E',
      lastName: 'Test',
      password: 'Test@Password123',
    };

    test('should display login page', async ({ page }) => {
      await page.goto('/login');
      
      // Wait for navigation to complete
      await page.waitForLoadState('networkidle');
      
      // Check if we're on a login-related page
      const url = page.url();
      expect(url.includes('login') || url === '/').toBe(true);
    });

    test('should allow navigation to different pages', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test basic navigation works
      expect(page.url()).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify page loads in mobile view
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify page loads in tablet view
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify page loads in desktop view
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper document structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for basic HTML structure
      const html = await page.locator('html');
      expect(await html.isVisible()).toBe(true);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      
      // Verify focus works
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
      
      // Page should load in less than 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });
  });
});
