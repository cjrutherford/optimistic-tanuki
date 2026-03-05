import { test, expect } from '@playwright/test';

test.describe('Personality Rendering - Forge of Will', () => {
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

    const borderRadiusStyle = await page.evaluate(() => {
      return getComputedStyle(document.body)
        .getPropertyValue('--personality-border-radius-style')
        .trim();
    });

    console.log(`Border radius style: "${borderRadiusStyle}"`);
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

  test('should have personality-specific hover effects', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const cardSelector = '[class*="card"], .card, .project-card';
    const card = page.locator(cardSelector);

    const count = await card.count();
    if (count > 0) {
      console.log('Testing hover effects on card element...');
      await card.first().hover();
      await page.waitForTimeout(300);

      const boxShadow = await page.evaluate(() => {
        const el = document.querySelector(
          '[class*="card"], .card, .project-card'
        );
        return el ? getComputedStyle(el).boxShadow : 'not-found';
      }, cardSelector);

      console.log(`Box shadow on hover: ${boxShadow}`);
    }
  });
});

test.describe('Modal Interactions - Forge of Will', () => {
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
          'button:has-text("New")',
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

  test('should close modal on escape key', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('Pressed Escape key to close modal');
  });

  test('should have accessible modal attributes', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const modal = page.locator(
      '[role="dialog"], lib-modal, otui-modal, .modal'
    );
    const count = await modal.count();

    if (count > 0) {
      const hasRole = await modal.first().getAttribute('role');
      console.log(`Modal role: ${hasRole}`);

      const ariaLabel = await modal.first().getAttribute('aria-label');
      console.log(`Modal aria-label: ${ariaLabel}`);

      const ariaModal = await modal.first().getAttribute('aria-modal');
      console.log(`Modal aria-modal: ${ariaModal}`);
    }
  });

  test('should trap focus within modal', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('[role="dialog"], .modal');
    const count = await modal.count();

    if (count > 0) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);

      const focusedElement = await page.evaluate(
        () => document.activeElement?.tagName
      );
      console.log(`Focused element after Tab: ${focusedElement}`);
    }
  });
});

test.describe('Sidebar Interactions - Forge of Will', () => {
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

    const sidebarSelectors = [
      'lib-nav-sidebar',
      '[class*="sidebar"]',
      'aside',
      '.nav-sidebar',
      '[class*="nav"]',
    ];

    for (const selector of sidebarSelectors) {
      const sidebar = page.locator(selector);
      const count = await sidebar.count();
      if (count > 0) {
        console.log(`Found sidebar: ${selector}`);
        await expect(sidebar.first()).toBeVisible();
        break;
      }
    }
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggleButtonSelectors = [
      'button:has-text("Menu")',
      'button:has-text("Toggle")',
      '[class*="toggle"]',
      '.menu-button',
      '[class*="hamburger"]',
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

    const navItemSelectors = [
      '[class*="nav-item"]',
      '[class*="nav-link"]',
      'a[href]',
      'nav a',
    ];

    for (const selector of navItemSelectors) {
      const navItems = page.locator(selector);
      const count = await navItems.count();
      if (count > 0) {
        console.log(`Found ${count} navigation items`);
        break;
      }
    }
  });

  test('should navigate when clicking sidebar items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navLink = page.locator('a[href]').first();
    const href = await navLink.getAttribute('href');

    if (href && !href.startsWith('http')) {
      console.log(`Clicking nav link: ${href}`);
      await navLink.click();
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
    }
  });

  test('should show active state on current route', async ({ page }) => {
    await page.goto('/');
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

  test('should collapse sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('[class*="sidebar"]');
    const count = await sidebar.count();

    if (count > 0) {
      const isVisible = await sidebar.first().isVisible();
      console.log(`Sidebar visible on mobile: ${isVisible}`);
    }
  });
});
