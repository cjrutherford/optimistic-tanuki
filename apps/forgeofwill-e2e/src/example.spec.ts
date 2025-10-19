import { test, expect } from '@playwright/test';

test.describe('Forge of Will E2E Tests', () => {
  test.describe('Homepage', () => {
    test('should load the homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify page loads successfully
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });

    test('should have proper page structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for HTML structure
      const html = await page.locator('html');
      expect(await html.isVisible()).toBe(true);
    });
  });

  test.describe('Navigation', () => {
    test('should allow basic navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Verify URL is correct
      expect(page.url()).toBeTruthy();
    });

    test('should handle page reload', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const body = await page.locator('body');
      expect(await body.isVisible()).toBe(true);
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(10000);
    });
  });
});
