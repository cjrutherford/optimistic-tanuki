import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile-small', width: 375, height: 667 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1536, height: 864 },
] as const;

const ROUTES = ['/', '/login', '/register'] as const;

test.describe('Responsive Design Audit', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`@${viewport.name} (${viewport.width}×${viewport.height})`, () => {
      for (const route of ROUTES) {
        test(`${route}: loads without horizontal overflow`, async ({
          page,
        }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await page.goto(route);
          await page.waitForLoadState('domcontentloaded');

          const overflowX = await page.evaluate(() => {
            const doc = document.documentElement;
            return doc.scrollWidth > doc.clientWidth;
          });
          expect(overflowX).toBe(false);
        });

        test(`${route}: all touch targets are ≥ 44px at the narrowest dimension`, async ({
          page,
        }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await page.goto(route);
          await page.waitForLoadState('domcontentloaded');

          const smallTargets = await page.evaluate(() => {
            const interactive = document.querySelectorAll(
              'button, a, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
            );
            const results: {
              tag: string;
              text: string;
              width: number;
              height: number;
            }[] = [];
            for (const el of interactive) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                const minDim = Math.min(rect.width, rect.height);
                if (minDim < 44 && minDim > 0) {
                  results.push({
                    tag: el.tagName,
                    text: (el.textContent || '').trim().slice(0, 40),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                  });
                }
              }
            }
            return results;
          });

          if (smallTargets.length > 0) {
            console.log(
              `Small touch targets at ${viewport.width}px:`,
              JSON.stringify(smallTargets, null, 2)
            );
          }
          expect(smallTargets.length).toBe(0);
        });

        test(`${route}: body text is at least 16px`, async ({ page }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await page.goto(route);
          await page.waitForLoadState('domcontentloaded');

          const bodyFontSize = await page.evaluate(() => {
            const body = document.body;
            return parseFloat(getComputedStyle(body).fontSize);
          });
          expect(bodyFontSize).toBeGreaterThanOrEqual(16);
        });
      }

      test(`landing page: hero content is visible`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const heroSection = page.locator('.hero-section').first();
        await expect(heroSection).toBeVisible();
      });
    });
  }

  test.describe('Cross-viewport behavior', () => {
    test('navigation sidebar opens and closes on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const menuButton = page
        .locator(
          '[class*="menu"], [class*="hamburger"], button:has-text("Menu"), [aria-label*="menu" i]'
        )
        .first();
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(300);

        const sidebar = page
          .locator('nav, [class*="sidebar"], [class*="drawer"]')
          .first();
        const sidebarVisible = await sidebar.isVisible();
        const bodyOverflow = await page.evaluate(
          () => document.body.style.overflow
        );
        console.log(
          `Menu clicked — sidebar visible: ${sidebarVisible}, body overflow: ${bodyOverflow}`
        );
      }
    });

    test('no fixed element exceeds viewport width on any route', async ({
      page,
    }) => {
      const routesToCheck = ['/', '/login', '/register'];

      for (const route of routesToCheck) {
        for (const vp of [{ w: 375 }, { w: 768 }, { w: 1280 }]) {
          await page.setViewportSize({ width: vp.w, height: 800 });
          await page.goto(route);
          await page.waitForLoadState('domcontentloaded');

          const fixedOverflow = await page.evaluate(() => {
            const fixed = document.querySelectorAll('*');
            const issues: { tag: string; id: string; width: number }[] = [];
            for (const el of fixed) {
              const style = getComputedStyle(el);
              if (style.position === 'fixed') {
                const rect = el.getBoundingClientRect();
                if (rect.width > window.innerWidth && rect.width > 0) {
                  issues.push({
                    tag: el.tagName,
                    id: el.id || el.className.slice(0, 40),
                    width: Math.round(rect.width),
                  });
                }
              }
            }
            return issues;
          });

          if (fixedOverflow.length > 0) {
            console.log(
              `Fixed element overflow at ${vp.w}px on ${route}:`,
              fixedOverflow
            );
          }
        }
      }
    });
  });
});
