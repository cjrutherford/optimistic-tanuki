import { test, expect } from '@playwright/test';

// Fail-closed contract for the Civic Core SPA served WITHOUT a backend.
// Every route must render a truthful unavailable/empty state and must never
// display fabricated meetings, projects, or advisories.

test('portal shell renders with skip link and no broadcast banner', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Council and commission agendas' })
  ).toBeVisible();
  await expect(page.getByText('Skip to main content')).toBeVisible();
  await expect(page.locator('.broadcast-banner')).toHaveCount(0);
  const body = await page.textContent('body');
  expect(body).not.toContain('Call to order');
});

test('agendas show unavailable archive, never fabricated meetings', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByText('Meeting records are unavailable. Nothing is displayed.')
  ).toBeVisible();
  await expect(page.locator('.agenda-card')).toHaveCount(0);
});

test('projects show unavailable program with an honest map notice', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(
    page.getByText(
      'Transportation projects are unavailable. Nothing is displayed.'
    )
  ).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(0);
});

test('agenda search submits without inventing results', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search agendas').fill('rezoning');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(
    page.getByText('Meeting records are unavailable. Nothing is displayed.')
  ).toBeVisible();
  await expect(page.locator('.agenda-card')).toHaveCount(0);
});

test('keyboard users can search published agendas at the /agendas route', async ({
  page,
}) => {
  let requestedUrl = '';
  await page.route('**/api/v1/civic/agendas**', async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({ json: [] });
  });

  await page.goto('/agendas');
  const search = page.getByRole('search', { name: 'Search meeting records' });
  await expect(search).toBeVisible();
  const input = page.getByRole('searchbox', { name: 'Search agendas' });
  await input.focus();
  await input.fill('rezoning');
  await input.press('Enter');

  await expect.poll(() => requestedUrl).toContain('search=rezoning');
  await expect(input).toBeFocused();
});

test('project details use a modal with keyboard and pointer focus handling', async ({
  page,
}) => {
  await page.route('**/api/v1/civic/tip-projects**', async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'tip-1',
          name: 'River Street safety upgrade',
          description: 'Protected crossings and a redesigned intersection.',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-81.1, 32.0],
              [-81.0, 32.1],
            ],
          },
          fundingAllocatedCents: 40000000,
          fundingSpentCents: 10000000,
          status: 'funded',
          milestone: 'Design complete',
        },
      ],
    });
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort()
  );

  await page.goto('/projects');
  const project = page.getByRole('button', {
    name: /River Street safety upgrade/,
  });
  await expect(project).toBeVisible();
  await project.focus();
  await expect(project).toBeFocused();
  await project.press('Enter');

  const dialog = page.getByRole('dialog', {
    name: 'River Street safety upgrade details',
  });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close project details' });
  await expect(close).toBeFocused();
  await expect(
    page.getByText('Current milestone: Design complete')
  ).toBeVisible();
  await expect(page.locator('.selection-announcement')).toContainText(
    'River Street safety upgrade details opened.'
  );

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(project).toBeFocused();

  await project.click();
  await expect(dialog).toBeVisible();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(project).toBeFocused();
});
