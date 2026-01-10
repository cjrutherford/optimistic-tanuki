import { test, expect } from '@playwright/test';

// Basic smoke test that the client-interface app is up behind the gateway stack

test.describe('Client Interface Full-Stack Smoke', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Optimistic Tanuki|Client Interface/i);
  });
});
