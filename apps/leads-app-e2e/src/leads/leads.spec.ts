import { test, expect } from '@playwright/test';

test.describe('Leads App E2E', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:4200';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test('should display leads page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Lead Tracker');
  });

  test('should have Add Lead button', async ({ page }) => {
    await expect(page.locator('button:has-text("Add Lead")')).toBeVisible();
  });

  test('should open create lead modal', async ({ page }) => {
    await page.click('button:has-text("Add Lead")');
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Create New Lead');
  });

  test('should have stats cards', async ({ page }) => {
    await expect(page.locator('.stat-card')).toHaveCount(5);
    await expect(page.locator('.stat-label').first()).toContainText(
      'Total Leads'
    );
  });

  test('should have leads table with headers', async ({ page }) => {
    await expect(page.locator('table thead th').first()).toContainText('Name');
    await expect(page.locator('table thead th').nth(1)).toContainText(
      'Company'
    );
    await expect(page.locator('table thead th').nth(2)).toContainText('Email');
    await expect(page.locator('table thead th').nth(3)).toContainText('Source');
    await expect(page.locator('table thead th').nth(4)).toContainText('Status');
    await expect(page.locator('table thead th').nth(5)).toContainText('Value');
    await expect(page.locator('table thead th').nth(6)).toContainText(
      'Actions'
    );
  });

  test('should close modal on cancel', async ({ page }) => {
    await page.click('button:has-text("Add Lead")');
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.modal-content')).not.toBeVisible();
  });

  test('should close modal on overlay click', async ({ page }) => {
    await page.click('button:has-text("Add Lead")');
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.click('.modal-overlay');
    await expect(page.locator('.modal-content')).not.toBeVisible();
  });
});
