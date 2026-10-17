import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Forge public accessibility and product truth', () => {
  test('keeps the landing page navigable, readable, and free of unsupported AI promises', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /from plan to progress/i })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /skip to main content/i })
    ).toHaveAttribute('href', '#main-content');
    await expect(
      page.getByText(/AI assistance|Use AI where it helps/i)
    ).toHaveCount(0);
    await expect(page.locator('.forge-background')).toHaveAttribute(
      'aria-hidden',
      'true'
    );

    // Text sections reveal on different schedules. Sample their settled
    // colors after finite entrances, while decorative loops keep running.
    await page.getByRole('main').evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .filter((animation) =>
            Number.isFinite(animation.effect?.getTiming().iterations ?? 1)
          )
          .map((animation) => animation.finished.catch(() => undefined))
      );
    });
    await expect
      .poll(() =>
        page
          .locator('.stat-item, .forge-trust')
          .evaluateAll(
            (elements) =>
              elements.length > 0 &&
              elements.every(
                (element) => getComputedStyle(element).opacity === '1'
              )
          )
      )
      .toBe(true);

    const accessibility = await new AxeBuilder({ page })
      .include('main')
      .analyze();

    expect(accessibility.violations).toEqual([]);
  });

  test('keeps the public forge layout within a 375px viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      )
      .toBe(true);
  });
});
