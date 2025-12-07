import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { angularApps, AppConfig, RouteConfig } from '../app-configs';

const SCREENSHOTS_DIR = path.join(__dirname, '../../../screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Take a screenshot of a specific route
 */
async function captureScreenshot(
  page: Page,
  app: AppConfig,
  route: RouteConfig,
  viewport: { width: number; height: number; name: string }
) {
  const url = `${app.baseUrl}${route.path}`;
  console.log(`Navigating to: ${url}`);

  try {
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the specific selector if provided
    if (route.waitForSelector) {
      await page.waitForSelector(route.waitForSelector, { timeout: 10000 });
    }

    // Execute any custom before-screenshot logic
    if (route.beforeScreenshot) {
      await route.beforeScreenshot(page);
    }

    // Wait a bit for any animations to complete
    await page.waitForTimeout(1000);

    // Create app-specific directory
    const appDir = path.join(SCREENSHOTS_DIR, app.name);
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    // Take full page screenshot
    const screenshotPath = path.join(
      appDir,
      `${route.name}-${viewport.name}.png`
    );
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    console.log(`✓ Screenshot saved: ${screenshotPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to capture ${route.name} on ${app.name}:`, error);
    return false;
  }
}

/**
 * Test suite for each Angular application
 */
for (const app of angularApps) {
  test.describe(`${app.name} Screenshots`, () => {
    test.beforeAll(async () => {
      console.log(`\n=== Starting screenshots for ${app.name} ===`);
    });

    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];

    for (const viewport of viewports) {
      test.describe(`${viewport.name} viewport`, () => {
        for (const route of app.routes) {
          test(`capture ${route.name} screenshot`, async ({ page }) => {
            // Set viewport size
            await page.setViewportSize({
              width: viewport.width,
              height: viewport.height,
            });

            // Capture the screenshot
            const success = await captureScreenshot(page, app, route, viewport);
            expect(success).toBe(true);
          });
        }
      });
    }

    test.afterAll(async () => {
      console.log(`=== Completed screenshots for ${app.name} ===\n`);
    });
  });
}
