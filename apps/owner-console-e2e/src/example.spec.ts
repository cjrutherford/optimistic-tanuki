import { test, expect } from '@playwright/test';

test.describe('Owner Console E2E Tests', () => {
  test.describe('Homepage & Authentication Redirect', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
      await page.goto('/');
      
      // Should redirect to /login
      await expect(page).toHaveURL(/.*login/);
      
      // Verify login page content
      const title = page.locator('h1');
      await expect(title).toContainText('Owner Console');
    });

    test('should have proper document structure', async ({ page }) => {
      await page.goto('/login');
      
      const html = page.locator('html');
      await expect(html).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should have register link on login page', async ({ page }) => {
      await page.goto('/login');
      
      const registerLink = page.locator('a[href*="register"]');
      await expect(registerLink).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');
      const registerLink = page.locator('a[href*="register"]');
      await registerLink.click();
      
      await expect(page).toHaveURL(/.*register/);
    });

    test('should have login link on register page', async ({ page }) => {
      await page.goto('/register');
      
      const loginLink = page.locator('a[href*="login"]');
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');
      
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Registration Page', () => {
    test('should display registration content', async ({ page }) => {
      await page.goto('/register');
      
      // Should display something indicating it's the registration page
      const body = page.locator('body');
      await expect(body).toContainText('Register');
    });
  });

  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      
      // Should have email and password inputs (via custom components)
      const emailInput = page.locator('input[type="text"], input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    });
  });
});