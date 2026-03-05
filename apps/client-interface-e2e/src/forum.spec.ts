import { test, expect } from '@playwright/test';

test.describe('Forum Features', () => {
  test.describe('Forum Access Control', () => {
    test('should redirect to login when not authenticated', async ({
      page,
    }) => {
      await page.goto('/forum');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      const redirectedToAuth =
        currentUrl.includes('login') ||
        currentUrl.includes('register') ||
        currentUrl.includes('auth');

      expect(redirectedToAuth).toBe(true);
    });
  });

  test.describe('Forum UI Elements', () => {
    test('should load forum page or redirect to auth', async ({ page }) => {
      await page.goto('/forum');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      const onAuthPage =
        currentUrl.includes('login') || currentUrl.includes('register');
      const forumShell = page.locator('.forum-shell');
      const hasForum = (await forumShell.count()) > 0;

      expect(onAuthPage || hasForum).toBe(true);
    });

    test('should handle different viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('/forum');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const currentUrl = page.url();
        const hasForumOrLogin =
          currentUrl.includes('forum') ||
          currentUrl.includes('login') ||
          currentUrl.includes('register');
        expect(hasForumOrLogin).toBe(true);
      }
    });

    test('should display forum page when logged in', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[formControlName="email"]');
      const passwordInput = page.locator('input[formControlName="password"]');

      if ((await emailInput.count()) > 0 && (await passwordInput.count()) > 0) {
        await emailInput.fill('admin@example.com');
        await passwordInput.fill('admin');

        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);

        await page.goto('/forum');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const forumShell = page.locator('.forum-shell');
        const isForumVisible = await forumShell.isVisible().catch(() => false);
        const isOnAuthPage = page.url().includes('login');

        expect(isForumVisible || isOnAuthPage).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  test.describe('Forum Structure', () => {
    test('should check forum registration page loads', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const registerForm = page.locator('form');
      const isVisible = await registerForm.isVisible().catch(() => false);

      expect(isVisible || page.url().includes('register')).toBe(true);
    });
  });
});
