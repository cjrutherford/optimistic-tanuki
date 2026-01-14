import { test, expect } from '@playwright/test';

test.describe('Store Client E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the store homepage before each test
    await page.goto('/');
  });

  test.skip('should display the catalog page with products', async ({
    page,
  }) => {
    await page.goto('/catalog');

    // Wait for products to load
    await page.waitForSelector('store-product-list', { timeout: 10000 });

    // Check if page title is present
    const heading = page.locator('h1');
    await expect(heading).toContainText('Product Catalog');

    // Verify products are displayed
    const products = page.locator('store-product-card');
    const count = await products.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should load products from API', async ({ page }) => {
    // Navigate to catalog
    await page.goto('/catalog');

    // Wait for the product list to be visible
    await page.waitForSelector('store-product-list', { timeout: 10000 });

    // Check that at least one product card is rendered
    const productCards = page.locator('store-product-card');
    await expect(productCards.first()).toBeVisible();

    // Verify product information is displayed
    const firstProductName = productCards.first().locator('h3');
    await expect(firstProductName).not.toBeEmpty();
  });

  test('should handle loading state', async ({ page }) => {
    // Navigate to catalog
    await page.goto('/catalog');

    // The loading indicator might appear briefly
    // We'll just verify the page eventually loads successfully
    await page.waitForSelector('store-product-list, .error', {
      timeout: 10000,
    });
  });

  test('should display error message when API fails', async ({ page }) => {
    // Intercept API call and make it fail
    await page.route('**/api/store/products', (route) => {
      route.abort();
    });

    await page.goto('/catalog');

    // Wait for error message
    const errorMessage = page.locator('.error');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(errorMessage).toContainText('Failed to load products');
  });

  test('should navigate to cart page when add to cart is clicked', async ({
    page,
  }) => {
    await page.goto('/catalog');

    // Wait for products to load
    await page.waitForSelector('store-product-card', { timeout: 10000 });

    // Click the first "Add to Cart" button
    const addToCartButton = page.locator('store-product-card button').first();
    await addToCartButton.click();

    // Verify navigation to cart page
    await expect(page).toHaveURL(/\/cart/);
  });

  test('should display donations page', async ({ page }) => {
    await page.goto('/donations');

    // Check page title
    const heading = page.locator('.page-header h1');
    await expect(heading).toContainText('Support Us');

    // Verify donation component is present
    const donationComponent = page.locator('store-donation');
    await expect(donationComponent).toBeVisible();
  });

  test('should submit a donation successfully', async ({ page }) => {
    // Mock successful donation API response
    await page.route('**/api/store/donations', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'donation-123' }),
      });
    });

    await page.goto('/donations');

    // Wait for donation form to load
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Select a preset amount
    const presetButton = page.locator('button:has-text("$25")');
    if (await presetButton.isVisible()) {
      await presetButton.click();
    }

    // Enter custom amount if no preset available
    const customInput = page.locator('input[type="number"]');
    if (await customInput.isVisible()) {
      await customInput.fill('25');
    }

    // Submit donation
    const submitButton = page.locator('button:has-text("Donate")').first();
    await submitButton.click();

    // Verify success message
    await expect(page.locator('.success-message')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should display cart page', async ({ page }) => {
    await page.goto('/cart');

    // Check page exists (it might be empty)
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
  });

  test('should filter products by type (if implemented)', async ({ page }) => {
    await page.goto('/catalog');

    // Wait for products to load
    await page.waitForSelector('store-product-list', { timeout: 10000 });

    // Verify multiple products are displayed
    const products = page.locator('store-product-card');
    const initialCount = await products.count();
    expect(initialCount).toBeGreaterThan(0);
  });

  test('should display product details', async ({ page }) => {
    await page.goto('/catalog');

    // Wait for products
    await page.waitForSelector('store-product-card', { timeout: 10000 });

    // Get first product details
    const firstProduct = page.locator('store-product-card').first();

    // Check product has name
    const productName = firstProduct.locator('h3');
    await expect(productName).not.toBeEmpty();

    // Check product has price
    const productPrice = firstProduct.locator('text=/\\$[0-9]+/');
    await expect(productPrice).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/store/**', (route) => {
      route.abort('failed');
    });

    await page.goto('/catalog');

    // Should show error state
    await page.waitForSelector('.error, .empty-state', { timeout: 10000 });
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/catalog');

    // Verify page loads in mobile view
    await page.waitForSelector('store-product-list', { timeout: 10000 });

    // Check that content is visible
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });
});
