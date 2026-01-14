import { test, expect } from '@playwright/test';

test.describe('Simplified Store Client E2E', () => {
  test('should load the catalog page title', async ({ page }) => {
    // Navigate to catalog (default route)
    await page.goto('/');

    // Just verify the page title or header loads, ignoring products for now
    const heading = page.locator('.page-header h1');
    await expect(heading).toContainText('Product Catalog');
  });

  test('should load the donations page', async ({ page }) => {
    await page.goto('/donations');

    const heading = page.locator('.page-header h1');
    await expect(heading).toContainText('Support Us');
  });

  test('should load the cart page', async ({ page }) => {
    await page.goto('/cart');

    // Cart might be empty, but page should load
    const content = page.locator('store-shopping-cart');
    await expect(content).toBeVisible();
  });
});
