import { test, expect } from '@playwright/test';

/**
 * Regression cover for the auth-surface defects found on 2026-08-19:
 *
 * - both routes rendered two <h1>s, because the shared auth block drew its own
 *   hero inside the card while the page drew a second one outside it;
 * - the card was a fixed 530px whose in-card hero left the form at ~156px wide
 *   on every desktop width, 1440px included;
 * - the card overflowed the viewport at 1024px, giving the page a horizontal
 *   scrollbar.
 */

const ROUTES = ['/login', '/register'] as const;

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '768', width: 768, height: 1000 },
  { name: '390', width: 390, height: 844 },
] as const;

// Below this the block stacks and the form takes the full card width; above it
// the form must still be wide enough to hold a real input.
const MIN_FORM_WIDTH = 240;

test.describe('Auth layout', () => {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route} at ${viewport.name}px has one heading, no overflow, and a usable form`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(route);

        // One page headline, not one per component.
        await expect(page.locator('h1')).toHaveCount(1);

        // No horizontal page scroll at any supported width.
        const overflows = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth + 1;
        });
        expect(overflows).toBe(false);

        // The form column must not collapse to a sliver inside the card.
        const formWidth = await page.evaluate(() => {
          const form = document.querySelector('.card-inner .form');
          return form ? Math.round(form.getBoundingClientRect().width) : 0;
        });
        expect(formWidth).toBeGreaterThanOrEqual(MIN_FORM_WIDTH);
      });
    }
  }

  test('login offers a route to registration', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Create one' })).toBeVisible();
  });

  test('registration offers a route back to login', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });
});
