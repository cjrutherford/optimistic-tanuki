import { test, expect } from '@playwright/test';

// Basic smoke test that the Owner Console app is reachable via full stack

test.describe('Owner Console Full-Stack Smoke', () => {
  test('should load the dashboard or login page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText(
      /Owner Console|Sign In|Login/i
    );
  });
});
