import { test, expect } from '@playwright/test';

// Frontend regression only: this fixture models published registry data, not
// production availability or shared authentication. Both real apps must run.
const apps = [
  {
    origin: process.env['OT_BASE_URL'] || 'http://127.0.0.1:8080',
    id: 'client-interface',
    name: 'Optimistic Tanuki',
  },
  {
    origin: process.env['TS_BASE_URL'] || 'http://127.0.0.1:8087',
    id: 'local-hub',
    name: 'Towne Square',
  },
];

for (const app of apps) {
  for (const { width, mode } of [
    { width: 1280, mode: 'light' },
    { width: 375, mode: 'dark' },
  ]) {
    test(`${app.name}: HAI keyboard, placement, and registry navigation at ${width}px (${mode})`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await context.addInitScript(
        ({ mode, id }) =>
          localStorage.setItem(
            'optimistic-tanuki-personality-theme',
            JSON.stringify({
              personalityId: id === 'local-hub' ? 'soft-touch' : 'classic',
              primaryColor: '#6366f1',
              mode,
              version: '1.0.0',
            })
          ),
        { mode, id: app.id }
      );
      await context.route('**/api/registry/apps', (route) =>
        route.fulfill({
          json: {
            success: true,
            data: {
              apps: apps.map((item) => ({
                appId: item.id,
                name: item.name,
                uiBaseUrl: item.origin + '/',
                visibility: 'public',
              })),
            },
          },
        })
      );
      await page.goto(app.origin);
      const tag = page.getByTestId('hai-about-tag');
      await tag.scrollIntoViewIfNeeded();
      await expect(tag).toBeVisible();
      const placement = await tag.evaluate((button) => {
        const host = button.closest('hai-about-tag')!;
        const main = document.querySelector('main')!;
        return {
          position: getComputedStyle(host).position,
          tagTop: button.getBoundingClientRect().top,
          mainBottom: main.getBoundingClientRect().bottom,
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height,
        };
      });
      expect(placement.position).toBe('relative');
      expect(placement.tagTop).toBeGreaterThanOrEqual(placement.mainBottom);
      expect(placement.width).toBeGreaterThanOrEqual(44);
      expect(placement.height).toBeGreaterThanOrEqual(44);
      await tag.focus();
      await page.keyboard.press('Enter');
      const dialog = page.locator('.modal-dialog').filter({
        has: page.getByRole('heading', {
          name: app.name,
          exact: true,
          level: 2,
        }),
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Close modal' })
      ).toBeFocused();
      await expect(page.getByTestId('hai-account-context')).toContainText(
        'Sign in separately in each app'
      );
      const contrast = await page
        .getByTestId('hai-account-context')
        .evaluate((text) => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d')!;
          const luminance = (color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const rgb = [...ctx.getImageData(0, 0, 1, 1).data]
              .slice(0, 3)
              .map((value) => {
                const v = value / 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          const ink = luminance(getComputedStyle(text).color);
          const surface = luminance(
            getComputedStyle(text.closest('.about-shell')!).backgroundColor
          );
          return (
            (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05)
          );
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      const tabBounds = await dialog.getByRole('tab').evaluateAll((tabs) =>
        tabs.map((tab) => {
          const bounds = tab.getBoundingClientRect();
          const dialog = tab.closest('.modal-dialog')!.getBoundingClientRect();
          return bounds.left >= dialog.left && bounds.right <= dialog.right;
        })
      );
      expect(tabBounds.every(Boolean)).toBe(true);
      // Reach directory entirely by keyboard from the initial close control.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(
        dialog.getByRole('tab', { name: 'Other HAI Apps' })
      ).toHaveAttribute('aria-selected', 'true');
      const sibling = apps.find((item) => item.id !== app.id)!;
      const runLink = dialog.getByTestId('hai-app-run-link');
      await expect(runLink).toHaveCount(1);
      await expect(runLink).toHaveAttribute('href', sibling.origin + '/');
      await expect(dialog).not.toContainText('Live');
      // Newly rendered last link must wrap to Close, and Shift+Tab back to it.
      const last = dialog.getByTestId('hai-app-repo-link').last();
      await last.focus();
      await page.keyboard.press('Tab');
      await expect(
        dialog.getByRole('button', { name: 'Close modal' })
      ).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(last).toBeFocused();
      const [next] = await Promise.all([
        context.waitForEvent('page'),
        runLink.click(),
      ]);
      await next.waitForLoadState();
      await expect(next).toHaveURL(sibling.origin + '/');
      await expect(next.getByTestId('hai-about-tag')).toBeAttached();
      await next.close();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(tag).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
    });
  }
  test(`${app.name}: unavailable registry does not advertise bundled localhost app links`, async ({
    page,
  }) => {
    await page.route('**/api/registry/apps', (route) =>
      route.fulfill({ status: 503, json: {} })
    );
    await page.goto(app.origin);
    await page.getByTestId('hai-about-tag').click();
    await page.getByRole('tab', { name: 'Other HAI Apps' }).click();
    await expect(page.getByTestId('hai-app-repo-link')).toHaveCount(7);
    await expect(page.getByTestId('hai-app-run-link')).toHaveCount(0);
  });
}
