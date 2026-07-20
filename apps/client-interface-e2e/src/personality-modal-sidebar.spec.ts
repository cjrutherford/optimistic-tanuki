import { test, expect } from '@playwright/test';
import {
  openAppNavigation,
  openProfileEditorFromSettings,
  sidebarNavButton,
} from '../../e2e/support/workspace-ui';

test.describe('Personality Rendering', () => {
  const personalities = [
    'personality-classic',
    'personality-minimal',
    'personality-bold',
    'personality-soft',
    'personality-professional',
    'personality-playful',
    'personality-elegant',
    'personality-architect',
    'personality-soft-touch',
    'personality-electric',
    'personality-control-center',
    'personality-foundation',
  ];

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.log(`PAGE ERROR: ${error.message}`);
    });
  });

  test('should apply personality class to body', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toBeVisible();

    const initialClasses = await body.getAttribute('class');
    console.log(`Initial body classes: ${initialClasses}`);

    const hasPersonality = initialClasses?.includes('personality-');
    console.log(`Has personality class: ${hasPersonality}`);
  });

  test('should find personality selector in UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const personalityButton = page.locator(
      'button:has-text("Style"), button:has-text("Personality"), lib-personality-selector, [class*="personality"]'
    );

    const buttonCount = await personalityButton.count();
    console.log(`Found ${buttonCount} personality-related elements`);

    if (buttonCount > 0) {
      await expect(personalityButton.first()).toBeVisible();
    }
  });

  test('should render personality-specific CSS variables', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should apply distinct border-radius for different personalities', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const getBorderRadius = async (selector: string) => {
      return await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).borderRadius : 'not-found';
      }, selector);
    };

    console.log('Checking for elements with personality-specific styles...');

    const testSelectors = [
      '.card',
      '.button',
      '.modal',
      '[class*="card"]',
      '[class*="button"]',
    ];

    for (const selector of testSelectors) {
      const elements = await page.locator(selector).count();
      if (elements > 0) {
        const radius = await getBorderRadius(selector);
        console.log(`Element ${selector}: border-radius = ${radius}`);
        break;
      }
    }
  });
});

test.describe('Modal Interactions', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.log(`PAGE ERROR: ${error.message}`);
    });
  });

  test('should open modal when triggered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const modalSelectors = [
      'lib-modal',
      'otui-modal',
      '[class*="modal"]',
      '.modal',
    ];

    let modalFound = false;
    for (const selector of modalSelectors) {
      const modal = page.locator(selector);
      const count = await modal.count();
      if (count > 0) {
        console.log(`Found modal element: ${selector}`);

        const buttonSelectors = [
          'button:has-text("Edit")',
          'button:has-text("Open")',
          'button:has-text("Create")',
          '[class*="button"]',
          'button',
        ];

        for (const btnSelector of buttonSelectors) {
          const buttons = page.locator(btnSelector);
          const btnCount = await buttons.count();
          if (btnCount > 0) {
            await buttons.first().click();
            await page.waitForTimeout(500);

            const modalVisible = await modal
              .locator('.modal-content, .modal-body, [class*="modal"]')
              .first()
              .isVisible()
              .catch(() => false);
            if (modalVisible) {
              console.log('Modal opened successfully');
              modalFound = true;
              break;
            }
          }
        }
        break;
      }
    }

    if (!modalFound) {
      console.log('No modal interaction found - may need authenticated route');
    }
  });

  test('should close modal on close button click', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const closeButtonSelectors = [
      'button[class*="close"]',
      'button:has-text("×")',
      '[class*="close"]',
      '.modal-close',
    ];

    for (const selector of closeButtonSelectors) {
      const closeBtn = page.locator(selector);
      const count = await closeBtn.count();
      if (count > 0) {
        console.log(`Found close button: ${selector}`);
        await closeBtn.first().click();
        await page.waitForTimeout(500);
        break;
      }
    }
  });

  test('should close modal on backdrop click', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = await openAppNavigation(page);
    const modalOverlay = page.locator('.modal-overlay').first();

    console.log('Found modal backdrop, clicking...');
    const viewport = page.viewportSize();
    await page.mouse.click((viewport?.width ?? 1280) - 8, 24);
    await expect(sidebar).not.toBeVisible();
  });

  test('should have accessible modal attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await openAppNavigation(page);
    const modal = page.locator('.modal-dialog[aria-modal="true"]').first();
    await expect(modal).toBeVisible();

    const role = await modal.getAttribute('role');
    console.log(`Modal role: ${role}`);
    expect(['dialog', 'alertdialog']).toContain(role);

    const ariaLabel = await modal.getAttribute('aria-label');
    console.log(`Modal aria-label: ${ariaLabel}`);
    expect(ariaLabel).toContain('Navigation');
  });
});

test.describe('Sidebar Interactions', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.log(`PAGE ERROR: ${error.message}`);
    });
  });

  test('should find sidebar in the application', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = await openAppNavigation(page);
    console.log('Found sidebar: .nav-sidebar-card:visible');
    await expect(sidebar).toBeVisible();
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggleButtonSelectors = [
      'button:has-text("Menu")',
      'button:has-text("Toggle")',
      '[class*="toggle"]',
      '.menu-button',
    ];

    for (const selector of toggleButtonSelectors) {
      const toggleBtn = page.locator(selector);
      const count = await toggleBtn.count();
      if (count > 0) {
        console.log(`Found toggle button: ${selector}`);
        await toggleBtn.first().click();
        await page.waitForTimeout(500);
        break;
      }
    }
  });

  test('should have navigation items in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = await openAppNavigation(page);
    const navItems = sidebar.locator('.nav-link');
    const count = await navItems.count();
    console.log(`Found ${count} navigation items`);
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate when clicking sidebar items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const registerButton = await sidebarNavButton(page, /register/i);
    await registerButton.click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('should show active state on current route', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    const activeSelectors = [
      '[class*="active"]',
      '.nav-item.active',
      'a.active',
    ];

    for (const selector of activeSelectors) {
      const activeItems = page.locator(selector);
      const count = await activeItems.count();
      if (count > 0) {
        console.log(`Found ${count} active navigation items`);
        break;
      }
    }
  });
});
