import { expect, test } from '../../../e2e/playwright-hermetic';

test.describe('Christopher Rutherford Net E2E Tests', () => {
  test.describe('Homepage', () => {
    test('should load the homepage', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should have proper document structure', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const html = page.locator('html');
      await expect(html).toBeVisible();
    });
  });

  test.describe('SEO and Metadata', () => {
    test('should have proper meta tags', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Check for viewport meta tag
      const viewport = page.locator('meta[name="viewport"]');
      expect(await viewport.count()).toBeGreaterThan(0);
      await expect(page).toHaveTitle(
        'Christopher Rutherford | Systems Architect & Product Engineer'
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /Christopher Rutherford designs and builds dependable software systems/
      );

      const brandImage = page.locator('otui-app-bar img').first();
      await expect(brandImage).toBeVisible();
      await expect(brandImage).toHaveAttribute(
        'src',
        /assets\/images\/tanuki\.png/
      );
    });
  });

  test.describe('Navigation', () => {
    test('should allow basic navigation', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      expect(page.url()).toBeTruthy();
    });

    test('opens Systems Lab from the navigation menu', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.locator('otui-app-bar otui-button').click();
      await page.getByRole('button', { name: 'Systems Lab' }).click();

      await expect(page).toHaveURL(/#systems-lab$/);
      await expect(page.locator('#systems-lab')).toBeVisible();
    });

    test('should handle page reload', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
      const hasHorizontalOverflow = await body.evaluate(
        (element) => element.scrollWidth > element.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('renders the 18 registered web apps and their Systems Lab index entries', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 1080 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('.projectGrid [role="listitem"]')).toHaveCount(
        18
      );
      await expect(page.locator('#systems-lab .catalog-card')).toHaveCount(18);
      await expect(page.locator('#systems-lab .catalog-card a')).toHaveCount(
        18
      );
      await expect(
        page.getByRole('heading', { name: 'Web apps in the registry' })
      ).toBeVisible();
      await expect(
        page.locator('.catalog-card[data-app-id="leads-app"] a')
      ).toHaveAttribute('href', /tree\/main\/apps\/leads-app$/);
      await expect(
        page.locator('.catalog-card[data-app-id="ui-playground"]')
      ).toContainText('component and docs playground');
      await expect(
        page.locator('#systems-lab details.catalog-group')
      ).toHaveCount(2);
      await expect(
        page.locator('#systems-lab details.catalog-group[open]')
      ).toHaveCount(0);
      await expect(
        page.locator('#systems-lab .application-index')
      ).not.toContainText(/whitebox|matrix/i);
      const projectGrid = page.locator('.projectGrid[role="list"]');
      await expect(projectGrid).not.toContainText('Open app');
      await expect(projectGrid.locator('a[href*="localhost"]')).toHaveCount(0);
      await expect(projectGrid.locator('img[src*="localhost"]')).toHaveCount(0);
      await expect(page.locator('.portfolio-card')).toHaveCount(18);
    });

    test('centers the final card on desktop and tablet rows', async ({
      page,
    }) => {
      for (const [width, firstRowCount] of [
        [1280, 3],
        [768, 2],
      ]) {
        await page.setViewportSize({ width, height: 1080 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const grid = page.locator('.projectGrid[role="list"]');
        const layout = await grid.evaluate((element) => {
          const cards = Array.from(
            element.querySelectorAll('[role="listitem"]')
          );
          const rows = new Map<number, DOMRect[]>();
          for (const card of cards) {
            const rect = card.getBoundingClientRect();
            const top = Math.round(rect.top);
            rows.set(top, [...(rows.get(top) ?? []), rect]);
          }
          const gridRect = element.getBoundingClientRect();
          const finalRow = [...rows.values()].at(-1) ?? [];
          const finalCard = finalRow[0];
          return {
            rowSizes: [...rows.values()].map((row) => row.length),
            gridCenter: gridRect.left + gridRect.width / 2,
            finalCardCenter: finalCard
              ? finalCard.left + finalCard.width / 2
              : 0,
            firstCardWidth: cards[0]?.getBoundingClientRect().width ?? 0,
            finalCardWidth: finalCard?.width ?? 0,
          };
        });

        expect(layout.rowSizes[0]).toBe(firstRowCount);
        expect(layout.rowSizes.at(-1)).toBe(1);
        expect(layout.finalCardWidth).toBeGreaterThan(layout.firstCardWidth);
        expect(
          Math.abs(layout.finalCardCenter - layout.gridCenter)
        ).toBeLessThan(2);
      }
    });

    test('expands grouped app lists with the keyboard', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const internalTools = page
        .locator('#systems-lab details')
        .filter({ hasText: 'Internal tools' });
      const summary = internalTools.locator('summary');

      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(internalTools).toHaveAttribute('open', '');
      await expect(internalTools.locator('a')).toHaveCount(4);
      await expect(internalTools.locator('a').first()).toBeVisible();
    });

    test('keeps the expanded catalog inside a narrow mobile viewport', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.projectGrid [role="listitem"]')).toHaveCount(
        18
      );

      const metrics = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        cardWidths: Array.from(
          document.querySelectorAll('.portfolio-card')
        ).map((card) => card.getBoundingClientRect().width),
      }));
      expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(
        metrics.cardWidths.every((width) => width <= metrics.viewportWidth)
      ).toBe(true);
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(10000);
    });
  });
});
