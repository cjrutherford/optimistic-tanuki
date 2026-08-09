import { expect, test } from '@playwright/test';
import {
  expectPageLoads,
  findCity,
  findCommunity,
  getCommunities,
} from './helpers/local-hub-api';

test.describe('Public pages', () => {
  for (const path of ['/', '/cities', '/communities', '/login', '/register']) {
    test(`loads ${path}`, async ({ page }) => {
      await expectPageLoads(page, path);
    });
  }
});

test.describe('Public page responsive and map accessibility contracts', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const path of ['/', '/cities']) {
    test(`does not overflow horizontally at 375px on ${path}`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(
        page.locator(path === '/' ? 'h1.hero-title' : 'h1.page-title')
      ).toBeVisible();
      await expect(
        page.locator('.error-state, [data-error-state="true"]')
      ).toHaveCount(0);

      const bounds = await page.evaluate(() => {
        const selectors = [
          '.visual-card',
          '.feature-card',
          '.goal-card',
          '.business-card-demo',
          '.city-card',
          '.community-card',
          'button',
        ];
        const outOfBounds = selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll<HTMLElement>(selector))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > window.innerWidth + 1;
            })
            .map((element) => `${selector}:${element.className}`)
        );
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          outOfBounds,
        };
      });

      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth);
      expect(bounds.outOfBounds).toEqual([]);
    });
  }

  test('exposes locality markers as named keyboard-usable controls', async ({
    page,
    request,
  }) => {
    await page.goto('/cities');
    await page.waitForLoadState('domcontentloaded');
    expect(new URL(page.url()).pathname).toBe('/cities');
    await expect(page.locator('h1.page-title')).toBeVisible();
    const markers = page.locator('.map-marker--locality');
    await expect(markers.first()).toBeVisible();

    const markerA11y = await markers.evaluateAll((elements) =>
      elements.map((element) => ({
        role: element.getAttribute('role'),
        name: element.getAttribute('aria-label'),
        tabIndex: (element as HTMLElement).tabIndex,
      }))
    );

    expect(markerA11y.length).toBeGreaterThan(0);
    expect(markerA11y).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'button', tabIndex: 0 }),
      ])
    );
    expect(markerA11y.every(({ name }) => Boolean(name))).toBe(true);

    const marker = markers.first();
    const markerId = await marker
      .locator('.marker-dot')
      .getAttribute('data-map-marker-id');
    const city = (await getCommunities(request)).find(
      (community) => community.id === markerId
    );
    expect(markerId).toBeTruthy();
    expect(city?.slug).toBeTruthy();

    await marker.focus();
    await expect(marker).toBeFocused();
    await marker.press('Enter');
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/city/${city?.slug}`);
  });
});

test.describe('Public page desktop parity contracts', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const path of ['/', '/cities']) {
    test(`keeps the primary desktop layout visible on ${path}`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(
        page.locator(path === '/' ? 'h1.hero-title' : 'h1.page-title')
      ).toBeVisible();
      await expect(
        page.locator(path === '/' ? '.hero-visual' : '.map-rail')
      ).toBeVisible();
      await expect(
        page.locator('.error-state, [data-error-state="true"]')
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
    });
  }
});

test.describe('City and community detail pages', () => {
  test('loads city detail pages for seeded city', async ({ page, request }) => {
    const city = findCity(await getCommunities(request));
    test.skip(!city?.slug, 'No seeded city is available');

    await expectPageLoads(page, `/city/${city.slug}`);
    await expectPageLoads(page, `/city/${city.slug}/classifieds`);
  });

  test('loads community detail pages for seeded community', async ({
    page,
    request,
  }) => {
    const community = findCommunity(await getCommunities(request));
    test.skip(!community?.slug, 'No seeded non-city community is available');

    await expectPageLoads(page, `/c/${community.slug}`);
    await expectPageLoads(page, `/c/${community.slug}/classifieds`);
  });
});
