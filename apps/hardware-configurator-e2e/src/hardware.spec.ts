import { test, expect } from '@playwright/test';

test.describe('Hardware Portal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display landing page with chassis options', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Build Your Custom Server');
    await expect(page.locator('.chassis-card')).toHaveCount(8);
  });

  test('should navigate to configure page on chassis selection', async ({
    page,
  }) => {
    await page.locator('.chassis-card').first().click();
    await expect(page).toHaveURL(/\/configure\//);
    await expect(page.locator('h1')).toContainText('Configure Your');
  });

  test('should display compatible components on configure page', async ({
    page,
  }) => {
    await page.locator('.chassis-card').first().click();
    await expect(page.locator('.config-section')).toHaveCount(4);
    await expect(page.locator('.component-card').first()).toBeVisible();
  });

  test('should calculate price when components are selected', async ({
    page,
  }) => {
    await page.locator('.chassis-card').first().click();
    await page.locator('.component-card').first().click();
    await expect(page.locator('.price-summary')).toBeVisible();
    await expect(page.locator('.price-summary .total')).toContainText('$');
  });

  test('should enable continue button when config is valid', async ({
    page,
  }) => {
    await page.locator('.chassis-card').first().click();
    const continueBtn = page.locator('.continue-btn');
    await expect(continueBtn).toBeDisabled();
    await page.locator('.component-card').first().click();
    await page.locator('.component-card').nth(1).click();
    await page.locator('.component-card').nth(2).click();
    await expect(continueBtn).toBeEnabled();
  });

  test('should navigate to review page', async ({ page }) => {
    await page.locator('.chassis-card').first().click();
    await page.locator('.component-card').first().click();
    await page.locator('.component-card').nth(1).click();
    await page.locator('.component-card').nth(2).click();
    await page.locator('.continue-btn').click();
    await expect(page).toHaveURL(/\/review/);
    await expect(page.locator('h1')).toContainText('Review Your Configuration');
  });

  test('should display price breakdown on review page', async ({ page }) => {
    await page.locator('.chassis-card').first().click();
    await page.locator('.component-card').first().click();
    await page.locator('.component-card').nth(1).click();
    await page.locator('.component-card').nth(2).click();
    await page.locator('.continue-btn').click();
    await expect(page.locator('.price-card')).toBeVisible();
    await expect(page.locator('.price-row.total')).toContainText('Total');
  });

  test('should navigate to checkout page', async ({ page }) => {
    await page.locator('.chassis-card').first().click();
    await page.locator('.component-card').first().click();
    await page.locator('.component-card').nth(1).click();
    await page.locator('.component-card').nth(2).click();
    await page.locator('.continue-btn').click();
    await page.locator('.checkout-btn').click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator('h1')).toContainText('Checkout');
  });

  test('should show validation errors on empty checkout', async ({ page }) => {
    await page.locator('.chassis-card').first().click();
    await page.locator('.component-card').first().click();
    await page.locator('.component-card').nth(1).click();
    await page.locator('.component-card').nth(2).click();
    await page.locator('.continue-btn').click();
    await page.locator('.checkout-btn').click();
    await expect(page.locator('input:invalid')).toHaveCount(2);
  });
});
