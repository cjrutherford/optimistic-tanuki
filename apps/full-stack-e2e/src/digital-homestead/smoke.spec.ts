import { test, expect } from '@playwright/test';

// Basic smoke test that the Digital Homestead client is reachable via full stack

test.describe('Digital Homestead Full-Stack Smoke', () => {
  test('should load the blog homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/Digital Homestead|Blog/i);
  });
});
