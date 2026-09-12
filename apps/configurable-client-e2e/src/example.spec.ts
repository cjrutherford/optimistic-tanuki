import { test, expect } from '@playwright/test';

test('renders the anonymous discovery surface', async ({ page }) => {
  await page.goto('/');

  expect(await page.locator('h1').innerText()).toContain(
    'Build a client experience people can find'
  );
});

test('offers clear owner and client discovery paths', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Build a client experience/ })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Owner sign in' }).first()
  ).toHaveAttribute('href', '/login?returnTo=%2Fowner');
  await expect(
    page.getByRole('link', { name: 'Find a published app' }).first()
  ).toHaveAttribute('href', '#discoveries');
  await expect(
    page.getByRole('heading', { name: 'Published experiences' })
  ).toBeVisible();

  const publishedExperiences = page.getByRole('list', {
    name: 'Published experiences',
  });
  await expect(publishedExperiences).toBeVisible();
  await expect(publishedExperiences.getByRole('listitem')).toHaveCount(3);

  for (const app of [
    { name: 'demo-app', access: 'Public' },
    { name: 'Open Community', access: 'Joinable' },
    { name: 'Access Request Hub', access: 'Request-only' },
  ]) {
    const card = publishedExperiences
      .getByRole('listitem')
      .filter({ hasText: app.name });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(app.access);
  }

  await expect(publishedExperiences).not.toContainText('Private Studio');
  await expect(publishedExperiences).not.toContainText(
    /p11-(joinable|request-only|private)/i
  );
});

test('keeps discovery navigation usable on a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const menu = page.getByRole('button', { name: 'Open navigation' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();

  await expect(
    page.getByRole('button', { name: 'Close navigation' })
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'For clients' })).toBeVisible();
});
