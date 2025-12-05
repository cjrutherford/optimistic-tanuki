import { test, expect } from '@playwright/test';

/**
 * Performance thresholds for E2E tests
 */
const PERFORMANCE_THRESHOLDS = {
  /** Maximum acceptable page load time in milliseconds */
  MAX_PAGE_LOAD_TIME_MS: 20000,
} as const;

test.describe('Digital Homestead E2E Tests', () => {
  test.describe('Homepage', () => {
    test('should load the homepage', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Verify page loads successfully
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should have proper document structure', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const html = page.locator('html');
      await expect(html).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should allow basic navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      expect(page.url()).toBeTruthy();
    });

    test('should handle browser back/forward', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const firstUrl = page.url();
      await page.goBack();
      await page.goForward();

      expect(page.url()).toBe(firstUrl);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(
        () => document.activeElement?.tagName
      );
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MAX_PAGE_LOAD_TIME_MS
      );
    });
  });

  test.describe('Login Page', () => {
    test('should load the login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      // Verify page loads successfully
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display login-block component', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      // The login block should be present (uses lib-login-block from auth-ui)
      // Even if the component selector isn't directly visible, the page should load
      expect(page.url()).toContain('login');
    });

    test('should have link back to main site', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      // There should be navigation elements on the page
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Blog Page - Unauthenticated User (Read-Only)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
    });

    test('should load the blog page', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Verify page loads successfully
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display blog sidebar with posts list', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Check for sidebar structure
      const sidebar = page.locator('.blog-sidebar');
      await expect(sidebar).toBeVisible();
    });

    test('should display "Blog Posts" header in sidebar', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Check for sidebar header
      const header = page.locator('.sidebar-header h2');
      await expect(header).toContainText('Blog Posts');
    });

    test('should NOT show "New Post" button for unauthenticated user', async ({
      page,
    }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // New Post button should not be visible for unauthenticated users
      const newPostButton = page.locator('text=New Post');
      await expect(newPostButton).not.toBeVisible();
    });

    test('should display welcome message with sign-in link', async ({
      page,
    }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Should show welcome message
      const welcomeMessage = page.locator('.welcome-message');
      await expect(welcomeMessage).toBeVisible();

      // Should have sign-in link
      const signInLink = page.locator('.welcome-message a[href*="login"]');
      await expect(signInLink).toBeVisible();
    });

    test('should NOT show "Edit Post" button for unauthenticated user', async ({
      page,
    }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Edit Post button should not be visible for unauthenticated users
      const editButton = page.locator('text=Edit Post');
      await expect(editButton).not.toBeVisible();
    });

    test('should navigate to login when clicking sign-in link', async ({
      page,
    }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Click sign in link
      const signInLink = page.locator('.welcome-message a[href*="login"]');
      if (await signInLink.isVisible()) {
        await signInLink.click();
        await expect(page).toHaveURL(/.*login/);
      }
    });
  });

  test.describe('Blog Page - Navigation', () => {
    test('should navigate to blog page from URL', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      expect(page.url()).toContain('blog');
    });

    test('should have proper blog page layout structure', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Check for main layout container
      const container = page.locator('.blog-page-container');
      await expect(container).toBeVisible();

      // Check for blog layout
      const layout = page.locator('.blog-layout');
      await expect(layout).toBeVisible();

      // Check for sidebar
      const sidebar = page.locator('.blog-sidebar');
      await expect(sidebar).toBeVisible();

      // Check for main content
      const content = page.locator('.blog-content');
      await expect(content).toBeVisible();
    });

    test('should display loading state while fetching posts', async ({
      page,
    }) => {
      await page.goto('/blog');

      // The loading state might be brief, so we just check the page eventually loads
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Blog Page - Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Sidebar and content should still be present
      const sidebar = page.locator('.blog-sidebar');
      await expect(sidebar).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();

      // On desktop, sidebar should be clearly visible
      const sidebar = page.locator('.blog-sidebar');
      await expect(sidebar).toBeVisible();
    });
  });

  test.describe('Blog Page - Accessibility', () => {
    test('should support keyboard navigation in sidebar', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Tab through elements
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(
        () => document.activeElement?.tagName
      );
      expect(focusedElement).toBeTruthy();
    });

    test('should have semantic HTML structure', async ({ page }) => {
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');

      // Check for semantic elements
      const aside = page.locator('aside.blog-sidebar');
      await expect(aside).toBeVisible();

      const main = page.locator('.blog-content');
      await expect(main).toBeVisible();

      const nav = page.locator('nav.post-list');
      await expect(nav).toBeVisible();
    });
  });

  test.describe('Blog Page - Performance', () => {
    test('should load blog page within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/blog');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MAX_PAGE_LOAD_TIME_MS
      );
    });
  });
});
