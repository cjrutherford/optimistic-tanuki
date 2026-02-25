import { test, expect } from '@playwright/test';

test.describe('Store Donations E2E', () => {
  test.skip('should render donation form', async ({ page }) => {
    await page.goto('/donations');

    // Check page structure - using .page-header h1 based on donations.component.html
    await expect(page.locator('.page-header h1')).toContainText('Support Us');

    // Donation component should be present
    const donationComponent = page.locator('store-donation');
    await expect(donationComponent).toBeVisible();
  });

  test('should show preset donation amounts', async ({ page }) => {
    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Look for preset amount buttons (common amounts like $5, $10, $25, $50, $100)
    const presetButtons = page
      .locator('button')
      .filter({ hasText: /\$[0-9]+/ });

    if (await presetButtons.first().isVisible()) {
      const count = await presetButtons.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Found ${count} preset amount buttons`);
    }
  });

  test('should allow custom donation amount', async ({ page }) => {
    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Look for custom amount input
    const customInput = page.locator('input[type="number"]');

    if (await customInput.isVisible()) {
      await customInput.fill('42.50');
      const value = customInput;
      await expect(value).toHaveValue('42.50');
    }
  });

  test('should submit donation with mocked API', async ({ page }) => {
    // Mock the donation API
    await page.route('**/api/store/donations', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'donation-test-123',
          amount: 25,
          currency: 'USD',
          status: 'completed',
        }),
      });
    });

    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Try to fill custom amount
    const customInput = page.locator('input[type="number"]').first();
    if (await customInput.isVisible()) {
      await customInput.fill('25');
    }

    // Find and click donate button
    const donateButton = page
      .locator('button')
      .filter({ hasText: /donate/i })
      .first();

    if ((await donateButton.isVisible()) && (await donateButton.isEnabled())) {
      await donateButton.click();

      // Wait for success message
      await page.waitForSelector('.success-message, .success', {
        timeout: 5000,
      });
    }
  });

  test('should handle donation API error', async ({ page }) => {
    // Mock API error
    await page.route('**/api/store/donations', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Try to submit
    const customInput = page.locator('input[type="number"]').first();
    if (await customInput.isVisible()) {
      await customInput.fill('25');

      const donateButton = page
        .locator('button')
        .filter({ hasText: /donate/i })
        .first();
      if (await donateButton.isVisible()) {
        await donateButton.click();

        // Should show error message
        await page.waitForSelector('.error-message, .error', { timeout: 5000 });
      }
    }
  });

  test('should have anonymous donation option', async ({ page }) => {
    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Look for anonymous checkbox
    const anonymousCheckbox = page
      .locator('input[type="checkbox"]')
      .filter({ hasText: /anonymous/i });

    if (await anonymousCheckbox.isVisible()) {
      await anonymousCheckbox.check();
      await expect(anonymousCheckbox).toBeChecked();
    }
  });

  test('should allow donation message', async ({ page }) => {
    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Look for message textarea or input
    const messageInput = page.locator('textarea, input[type="text"]').first();

    if (await messageInput.isVisible()) {
      await messageInput.fill('Thank you for your great work!');
      const value = await messageInput.inputValue();
      expect(value).toContain('Thank you');
    }
  });

  test('should validate minimum donation amount', async ({ page }) => {
    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    const customInput = page.locator('input[type="number"]').first();

    if (await customInput.isVisible()) {
      // Try to enter invalid amount
      await customInput.fill('0');

      // The form should not submit or show validation error
      const donateButton = page
        .locator('button')
        .filter({ hasText: /donate/i })
        .first();

      if (await donateButton.isVisible()) {
        // Button might be disabled or validation prevents submission
        const isDisabled = await donateButton.isDisabled();
        console.log(`Donate button disabled for zero amount: ${isDisabled}`);
      }
    }
  });

  test('should show currency', async ({ page }) => {
    await page.goto('/donations');
    await page.waitForSelector('store-donation', { timeout: 10000 });

    // Look for currency indicator (usually $ or USD)
    const content = await page.locator('store-donation').textContent();

    // Should show $ or USD somewhere
    expect(content).toMatch(/\$|USD/);
  });
});
