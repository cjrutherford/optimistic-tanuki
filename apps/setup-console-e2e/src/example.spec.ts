import { test, expect } from '@playwright/test';

test.describe('Setup Console E2E Tests', () => {
  test.describe('Redirect When Setup Complete', () => {
    test('should redirect to owner console when setup is complete', async ({
      page,
    }) => {
      await page.goto('/');
      // The page should redirect to owner-console at localhost:8084
      await expect(page).toHaveTitle(/owner-console|Platform Setup/, {
        timeout: 15000,
      });
    });
  });

  test.describe('API Status', () => {
    test('should return setup status from API', async ({ page }) => {
      const response = await page.request.get('/api/setup/status');
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('configured');
      expect(body).toHaveProperty('wizardStep');
    });

    test('should return setup state from API', async ({ page }) => {
      const response = await page.request.get('/api/setup/state');
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('success');
      expect(body.data).toHaveProperty('version');
    });

    test('should return setup secrets from API', async ({ page }) => {
      const response = await page.request.get('/api/setup/secrets');
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('success');
    });
  });

  test.describe('State Read', () => {
    test('should read non-empty state from API', async ({ page }) => {
      const response = await page.request.get('/api/setup/state');
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.environment.name).toBeTruthy();
      expect(Array.isArray(body.data.services)).toBe(true);
      expect(body.data.services.length).toBeGreaterThan(0);
    });
  });
});
